import { prisma } from "../db.js";
import { logger } from "../lib/logger.js";
import { invalidateRole } from "./authorization.service.js";

export async function listRoles() {
  const roles = await prisma.role.findMany({
    include: {
      roleClaims: {
        include: { claim: { select: { key: true } } },
      },
      userRoles: { select: { userId: true } },
    },
    orderBy: { name: "asc" },
  });

  return roles.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    claims: r.roleClaims.map((rc) => rc.claim.key),
    userCount: r.userRoles.length,
  }));
}

export async function getRole(id: string) {
  const role = await prisma.role.findUnique({
    where: { id },
    include: {
      roleClaims: {
        include: { claim: { select: { id: true, key: true } } },
      },
      userRoles: { select: { userId: true } },
    },
  });

  if (!role) return null;

  return {
    id: role.id,
    name: role.name,
    description: role.description,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
    claims: role.roleClaims.map((rc) => ({
      id: rc.claim.id,
      key: rc.claim.key,
    })),
    userCount: role.userRoles.length,
  };
}

export async function createRole(data: {
  name: string;
  description?: string;
  claimIds: string[];
}) {
  const role = await prisma.role.create({
    data: {
      name: data.name,
      description: data.description,
      roleClaims: {
        create: data.claimIds.map((claimId) => ({ claimId })),
      },
    },
    include: {
      roleClaims: {
        include: { claim: { select: { id: true, key: true } } },
      },
    },
  });

  invalidateRole(role.id);
  logger.info({ roleId: role.id, name: role.name }, "Role created");

  return {
    id: role.id,
    name: role.name,
    description: role.description,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
    claims: role.roleClaims.map((rc) => ({
      id: rc.claim.id,
      key: rc.claim.key,
    })),
  };
}

export async function updateRole(
  id: string,
  data: { name?: string; description?: string; claimIds?: string[] },
) {
  const existing = await prisma.role.findUnique({ where: { id } });
  if (!existing) return null;

  await prisma.role.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
    },
  });

  if (data.claimIds !== undefined) {
    await prisma.roleClaim.deleteMany({ where: { roleId: id } });
    if (data.claimIds.length > 0) {
      await prisma.roleClaim.createMany({
        data: data.claimIds.map((claimId) => ({ roleId: id, claimId })),
      });
    }
  }

  invalidateRole(id);
  logger.info({ roleId: id }, "Role updated");

  return getRole(id);
}

export async function deleteRole(id: string) {
  const existing = await prisma.role.findUnique({ where: { id } });
  if (!existing) return { error: "Role not found" } as const;

  await prisma.$transaction(async (tx) => {
    await tx.userRole.deleteMany({ where: { roleId: id } });
    await tx.roleClaim.deleteMany({ where: { roleId: id } });
    await tx.role.delete({ where: { id } });
  });

  invalidateRole(id);
  logger.info({ roleId: id, name: existing.name }, "Role deleted");

  return { success: true as const };
}
