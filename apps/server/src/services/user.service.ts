import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { logger } from "../lib/logger.js";
import { BCRYPT_ROUNDS } from "../lib/auth.js";
import { resolveClaims } from "./authorization.service.js";

const ADMIN_CLAIMS = new Set(["ROLE_MANAGE", "USER_MANAGE"]);

export async function listUsers(options: { includeInactive: boolean }) {
  const where = options.includeInactive ? {} : { isActive: true };

  const users = await prisma.user.findMany({
    where,
    select: {
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
    },
    orderBy: { createdAt: "desc" },
  });

  return users.map((u) => ({
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
  }));
}

export async function getUser(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
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
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    roles: user.userRoles.map((ur) => ({
      id: ur.role.id,
      name: ur.role.name,
    })),
  };
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
      select: {
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
      },
    });
    return created;
  });

  logger.info({ userId: user.id, email: user.email }, "User created by admin");

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    roles: user.userRoles.map((ur) => ({
      id: ur.role.id,
      name: ur.role.name,
    })),
  };
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

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: {
        ...(data.email !== undefined && { email: data.email }),
        ...(data.firstName !== undefined && { firstName: data.firstName }),
        ...(data.lastName !== undefined && { lastName: data.lastName }),
      },
      select: {
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

  });

  const finalUser = await prisma.user.findUnique({
    where: { id },
    select: {
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
    },
  });

  logger.info({ userId: id }, "User updated by admin");

  if (!finalUser) return { error: "User not found" } as const;

  return {
    id: finalUser.id,
    email: finalUser.email,
    firstName: finalUser.firstName,
    lastName: finalUser.lastName,
    isActive: finalUser.isActive,
    createdAt: finalUser.createdAt,
    updatedAt: finalUser.updatedAt,
    roles: finalUser.userRoles.map((ur) => ({
      id: ur.role.id,
      name: ur.role.name,
    })),
  };
}

export async function deactivateUser(id: string) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return { error: "User not found" } as const;
  if (!existing.isActive) return { error: "User is already deactivated" } as const;

  const otherActiveUsers = await prisma.user.findMany({
    where: { id: { not: id }, isActive: true },
    select: {
      id: true,
      userRoles: { select: { roleId: true } },
    },
  });

  if (otherActiveUsers.length > 0) {
    const otherRoleIds = otherActiveUsers.flatMap((u) =>
      u.userRoles.map((ur) => ur.roleId),
    );

    if (otherRoleIds.length > 0) {
      const otherClaims = await resolveClaims(otherRoleIds);
      let hasAdminClaim = false;
      for (const claim of ADMIN_CLAIMS) {
        if (otherClaims.has(claim)) {
          hasAdminClaim = true;
          break;
        }
      }

      if (!hasAdminClaim) {
        return {
          error:
            "Cannot deactivate the last user with administrative privileges",
        } as const;
      }
    } else {
      return {
        error:
          "Cannot deactivate the last user with administrative privileges",
      } as const;
    }
  } else {
    return {
      error:
        "Cannot deactivate the last user with administrative privileges",
    } as const;
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: { isActive: false },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: now },
    }),
  ]);

  logger.info({ userId: id }, "User deactivated by admin");
  return { success: true as const };
}
