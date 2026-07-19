import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { logger } from "../lib/logger.js";
import { BCRYPT_ROUNDS } from "../lib/auth.js";
import { resolveClaims } from "./authorization.service.js";

export const ADMIN_CLAIMS = new Set(["ROLE_MANAGE", "USER_MANAGE"]);

export const LAST_ADMIN_ERROR =
  "Cannot remove administrative privileges from the last admin user";

/**
 * Given a set of user IDs that would lose admin privileges, check whether
 * at least one other active user (not in the set) still has admin claims.
 * Returns null if safe, or an error message if no other admin would remain.
 *
 * Accepts an optional transaction client. When provided, the user lookup
 * runs inside that transaction for TOCTOU protection.
 */
export async function ensureOtherAdminExists(
  userIdsPotentiallyLosingAdmin: string[],
  tx?: {
    user: {
      findMany(args: {
        where: Record<string, unknown>;
        select: Record<string, unknown>;
      }): Promise<Array<Record<string, unknown>>>;
    };
  },
): Promise<string | null> {
  if (userIdsPotentiallyLosingAdmin.length === 0) return null;

  const client = tx ?? prisma;
  const rows = (await client.user.findMany({
    where: { id: { notIn: userIdsPotentiallyLosingAdmin }, isActive: true },
    select: {
      id: true,
      userRoles: { select: { roleId: true } },
    },
  })) as Array<{ id: string; userRoles: Array<{ roleId: string }> }> | null ?? [];

  for (const user of rows) {
    const roleIds = user.userRoles.map((ur) => ur.roleId);
    if (roleIds.length > 0) {
      const claims = await resolveClaims(roleIds);
      for (const claim of ADMIN_CLAIMS) {
        if (claims.has(claim)) {
          return null;
        }
      }
    }
  }

  return LAST_ADMIN_ERROR;
}

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  userRoles: {
    select: {
      role: {
        select: { id: true, name: true },
      },
    },
  },
} as const;

function toUserDTO(u: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  userRoles: Array<{ role: { id: string; name: string } }>;
}) {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    isActive: u.isActive,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    roles: u.userRoles.map((ur) => ({
      id: ur.role.id,
      name: ur.role.name,
    })),
  };
}

export async function listUsers(options: { includeInactive: boolean }) {
  const where = options.includeInactive ? {} : { isActive: true };

  const users = await prisma.user.findMany({
    where,
    select: userSelect,
    orderBy: { createdAt: "desc" },
  });

  return users.map(toUserDTO);
}

export async function getUser(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: userSelect,
  });

  if (!user) return null;

  return toUserDTO(user);
}

export async function createUser(data: {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  roleIds: string[];
}) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    return { error: "Email already in use" } as const;
  }

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        userRoles: {
          create: data.roleIds.map((roleId) => ({ roleId })),
        },
      },
      select: userSelect,
    });
    return created;
  });

  logger.info({ userId: user.id }, "User created by admin");

  return toUserDTO(user);
}

export async function updateUser(
  id: string,
  data: {
    email?: string;
    firstName?: string;
    lastName?: string;
    roleIds?: string[];
  },
) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return { error: "User not found" } as const;

  if (data.email !== undefined && data.email !== existing.email) {
    const emailExists = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (emailExists) {
      return { error: "Email already in use" } as const;
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    if (data.roleIds !== undefined) {
      const newClaims = await resolveClaims(data.roleIds);
      const targetHasAdmin = [...ADMIN_CLAIMS].some((c) => newClaims.has(c));

      if (!targetHasAdmin) {
        const error = await ensureOtherAdminExists([id], tx);
        if (error) return { error } as const;
      }
    }

    await tx.user.update({
      where: { id },
      data: {
        ...(data.email !== undefined && { email: data.email }),
        ...(data.firstName !== undefined && { firstName: data.firstName }),
        ...(data.lastName !== undefined && { lastName: data.lastName }),
      },
    });

    if (data.roleIds !== undefined) {
      await tx.userRole.deleteMany({ where: { userId: id } });
      if (data.roleIds.length > 0) {
        await tx.userRole.createMany({
          data: data.roleIds.map((roleId) => ({ userId: id, roleId })),
        });
      }
    }

    return { ok: true as const };
  });

  if ("error" in result) return result as { error: string };

  const finalUser = await prisma.user.findUnique({
    where: { id },
    select: userSelect,
  });

  logger.info({ userId: id }, "User updated by admin");

  if (!finalUser) return { error: "User not found" } as const;

  return toUserDTO(finalUser);
}

export async function deactivateUser(id: string) {
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id } });
    if (!user) return { error: "User not found" } as const;
    if (!user.isActive) return { error: "User is already deactivated" } as const;

    const userRoles = await tx.userRole.findMany({
      where: { userId: id },
      select: { roleId: true },
    });
    const targetRoleIds = userRoles.map((ur) => ur.roleId);

    let targetIsAdmin = false;
    if (targetRoleIds.length > 0) {
      const targetClaims = await resolveClaims(targetRoleIds);
      for (const claim of ADMIN_CLAIMS) {
        if (targetClaims.has(claim)) {
          targetIsAdmin = true;
          break;
        }
      }
    }

    if (targetIsAdmin) {
      const error = await ensureOtherAdminExists([id], tx);
      if (error) return { error } as const;
    }

    const now = new Date();
    await tx.user.update({
      where: { id },
      data: { isActive: false },
    });
    await tx.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: now },
    });

    logger.info({ userId: id }, "User deactivated by admin");
    return { success: true as const };
  });

  return result;
}
