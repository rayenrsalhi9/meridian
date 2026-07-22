import { prisma } from "../db.js";
import { logger } from "../lib/logger.js";
import { invalidateRole, resolveClaimsInTx } from "./authorization.service.js";
import { ADMIN_CLAIMS, ensureOtherAdminExists } from "./user.service.js";

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
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.role.findUnique({ where: { id } });
    if (!existing) return null;

    if (data.claimIds !== undefined) {
      const oldClaims = await tx.roleClaim.findMany({
        where: { roleId: id },
        include: { claim: { select: { key: true } } },
      });
      const oldAdminClaimKeys = oldClaims
        .filter((rc: { claim: { key: string } }) =>
          ADMIN_CLAIMS.has(rc.claim.key),
        )
        .map((rc: { claim: { key: string } }) => rc.claim.key);

      const newClaimRecords = await tx.claim.findMany({
        where: { id: { in: data.claimIds } },
        select: { key: true },
      });
      const newAdminClaimKeys = newClaimRecords
        .filter((c: { key: string }) => ADMIN_CLAIMS.has(c.key))
        .map((c: { key: string }) => c.key);

      const hadAdmin = oldAdminClaimKeys.length > 0;
      const hasAdmin = newAdminClaimKeys.length > 0;
      const lostAllAdminClaims = hadAdmin && !hasAdmin;

      if (lostAllAdminClaims) {
        const usersWithRole = await tx.user.findMany({
          where: { isActive: true, userRoles: { some: { roleId: id } } },
          select: {
            id: true,
            userRoles: { select: { roleId: true } },
          },
        });

        const losingAdmin: string[] = [];
        for (const user of usersWithRole) {
          const otherRoleIds = user.userRoles
            .filter((ur: { roleId: string }) => ur.roleId !== id)
            .map((ur: { roleId: string }) => ur.roleId);

          let otherHasAdmin = false;
          if (otherRoleIds.length > 0) {
            const otherClaims = await resolveClaimsInTx(tx, otherRoleIds);
            for (const claim of ADMIN_CLAIMS) {
              if (otherClaims.has(claim)) {
                otherHasAdmin = true;
                break;
              }
            }
          }

          if (!otherHasAdmin) {
            losingAdmin.push(user.id);
          }
        }

        if (losingAdmin.length > 0) {
          const checkResult = await ensureOtherAdminExists(losingAdmin, tx);
          if (checkResult) return { error: checkResult.error, code: checkResult.code };
        }
      }
    }

    await tx.role.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
      },
    });

    if (data.claimIds !== undefined) {
      await tx.roleClaim.deleteMany({ where: { roleId: id } });
      if (data.claimIds.length > 0) {
        await tx.roleClaim.createMany({
          data: data.claimIds.map((claimId: string) => ({
            roleId: id,
            claimId,
          })),
        });
      }
    }

    return { ok: true as const };
  });

  if (result === null) return null;
  if ("error" in result) return result;

  invalidateRole(id);
  logger.info({ roleId: id }, "Role updated");

  return getRole(id);
}

export async function deleteRole(id: string) {
  const existing = await prisma.role.findUnique({ where: { id } });
  if (!existing) return { error: "Role not found" } as const;

  const result = await prisma.$transaction(async (tx) => {
    const usersWithRole =
      ((await tx.user.findMany({
        where: { isActive: true, userRoles: { some: { roleId: id } } },
        select: { id: true, userRoles: { select: { roleId: true } } },
      })) as Array<{
        id: string;
        userRoles: Array<{ roleId: string }>;
      }> | null) ?? [];

    const losingAdmin: string[] = [];
    for (const user of usersWithRole) {
      const otherRoleIds = user.userRoles
        .filter((ur) => ur.roleId !== id)
        .map((ur) => ur.roleId);

      let otherHasAdmin = false;
      if (otherRoleIds.length > 0) {
        const otherClaims = await resolveClaimsInTx(tx, otherRoleIds);
        for (const claim of ADMIN_CLAIMS) {
          if (otherClaims.has(claim)) {
            otherHasAdmin = true;
            break;
          }
        }
      }

      if (!otherHasAdmin) {
        losingAdmin.push(user.id);
      }
    }

    if (losingAdmin.length > 0) {
      const checkResult = await ensureOtherAdminExists(losingAdmin, tx);
      if (checkResult) return { error: checkResult.error, code: checkResult.code };
    }

    await tx.userRole.deleteMany({ where: { roleId: id } });
    await tx.roleClaim.deleteMany({ where: { roleId: id } });
    await tx.role.delete({ where: { id } });

    return { success: true as const };
  });

  if ("error" in result) return result;

  invalidateRole(id);
  logger.info({ roleId: id, name: existing.name }, "Role deleted");

  return { success: true as const };
}
