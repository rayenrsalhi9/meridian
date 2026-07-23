import bcrypt from "bcryptjs";
import { ADMIN_CLAIM_KEYS_SET } from "shared";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../db.js";
import { BCRYPT_ROUNDS } from "../lib/auth.js";
import { resolveClaimsInTx } from "./authorization.service.js";

class TxError extends Error {
  constructor(readonly payload: { error: string; code?: string }) {
    super(payload.error);
  }
}

const ADMIN_CLAIMS = ADMIN_CLAIM_KEYS_SET;

export const LAST_ADMIN_ERROR =
  "Cannot remove administrative privileges from the last admin user";
export const LAST_ADMIN_ERROR_CODE = "LAST_ADMIN";

export interface AdminCheckResult {
  error: string;
  code: string;
}

/**
 * Given a set of user IDs that would lose admin privileges, check whether
 * at least one other active user (not in the set) still has admin claims.
 * Returns null if safe, or an AdminCheckResult if no other admin would remain.
 *
 * Accepts an optional transaction client. When provided, the user lookup
 * and claim lookup run inside that transaction for TOCTOU protection.
 */
export async function ensureOtherAdminExists(
  userIdsPotentiallyLosingAdmin: string[],
  tx: Prisma.TransactionClient,
): Promise<AdminCheckResult | null> {
  if (userIdsPotentiallyLosingAdmin.length === 0) return null;

  // ponytail: global lock, serializes all last-admin checks.
  // Use a lock key derived from the operation context if concurrent
  // deactivations of different users become a bottleneck.
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(42)");

  const rows = await tx.user.findMany({
    where: { id: { notIn: userIdsPotentiallyLosingAdmin }, isActive: true },
    select: {
      id: true,
      userRoles: { select: { roleId: true } },
    },
  });

  for (const user of rows) {
    const roleIds = user.userRoles.map((ur) => ur.roleId);
    if (roleIds.length > 0) {
      const claims = await resolveClaimsInTx(tx, roleIds);
      for (const claim of ADMIN_CLAIMS) {
        if (claims.has(claim)) {
          return null;
        }
      }
    }
  }

  return { error: LAST_ADMIN_ERROR, code: LAST_ADMIN_ERROR_CODE };
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
  const existing = await prisma.user.findUnique({
    where: { email: data.email },
  });
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

  console.log("User created by admin", { userId: user.id });

  return toUserDTO(user);
}

/**
 * Guard deactivation: verify the user is not the last admin and revoke
 * their refresh tokens. Runs inside a transaction (tx must be active).
 * Does NOT update the user record itself — the caller owns that step.
 */
async function guardAndDeactivate(
  tx: Prisma.TransactionClient,
  id: string,
  skipAdminCheck = false,
): Promise<{ ok: true } | { error: string; code: string }> {
  if (skipAdminCheck) {
    const now = new Date();
    await tx.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: now },
    });
    return { ok: true as const };
  }

  const userRoles = await tx.userRole.findMany({
    where: { userId: id },
    select: { roleId: true },
  });
  const targetRoleIds = userRoles.map(
    (ur) => ur.roleId,
  );

  let targetIsAdmin = false;
  if (targetRoleIds.length > 0) {
    const targetClaims = await resolveClaimsInTx(tx, targetRoleIds);
    for (const claim of ADMIN_CLAIMS) {
      if (targetClaims.has(claim)) {
        targetIsAdmin = true;
        break;
      }
    }
  }

  if (targetIsAdmin) {
    const result = await ensureOtherAdminExists([id], tx);
    if (result) return { error: result.error, code: result.code } as const;
  }

  const now = new Date();
  await tx.refreshToken.updateMany({
    where: { userId: id, revokedAt: null },
    data: { revokedAt: now },
  });

  return { ok: true as const };
}

export async function updateUser(
  id: string,
  data: {
    email?: string;
    firstName?: string;
    lastName?: string;
    isActive?: boolean;
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

  let result: { ok: true } | { error: string; code?: string };
  try {
    result = await prisma.$transaction(async (tx) => {
      let adminCheckDone = false;

      if (data.roleIds !== undefined) {
        const newClaims = await resolveClaimsInTx(tx, data.roleIds);
        const targetHasAdmin = [...ADMIN_CLAIMS].some((c) => newClaims.has(c));

        if (!targetHasAdmin) {
          const checkResult = await ensureOtherAdminExists([id], tx);
          if (checkResult) return { error: checkResult.error, code: checkResult.code } as const;
          adminCheckDone = true;
        }
      }

      if (data.isActive === false) {
        // Atomic claim — prevents concurrent deactivation race
        const claimed = await tx.user.updateMany({
          where: { id, isActive: true },
          data: { isActive: false },
        });
        if (claimed.count === 0)
          return { error: "User is already deactivated" } as const;
        const guard = await guardAndDeactivate(tx, id, adminCheckDone);
        if ("error" in guard) throw new TxError(guard);
      }

      await tx.user.update({
        where: { id },
        data: {
          ...(data.email !== undefined && { email: data.email }),
          ...(data.firstName !== undefined && { firstName: data.firstName }),
          ...(data.lastName !== undefined && { lastName: data.lastName }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
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
  } catch (err) {
    if (err instanceof TxError) return err.payload;
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { error: "Email already in use" } as const;
    }
    throw err;
  }

  if ("error" in result) return result as { error: string; code?: string };

  const finalUser = await prisma.user.findUnique({
    where: { id },
    select: userSelect,
  });

  console.log("User updated by admin", { userId: id });

  if (!finalUser) return { error: "User not found" } as const;

  return toUserDTO(finalUser);
}

export async function deactivateUser(id: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      // Atomic claim — prevents concurrent deactivation race
      const claimed = await tx.user.updateMany({
        where: { id, isActive: true },
        data: { isActive: false },
      });
      if (claimed.count === 0) {
        const user = await tx.user.findUnique({ where: { id }, select: { id: true } });
        if (!user) return { error: "User not found" } as const;
        return { error: "User is already deactivated" } as const;
      }

      const guard = await guardAndDeactivate(tx, id);
      if ("error" in guard) throw new TxError(guard);

      console.log("User deactivated by admin", { userId: id });
      return { success: true as const };
    });
  } catch (err) {
    if (err instanceof TxError) return err.payload;
    throw err;
  }
}
