import { prisma } from "../db.js";
import { Prisma } from "../generated/prisma/client.js";

export const claimCache = new Map<string, Set<string>>();

export function resetForTests(): void {
  if (process.env.NODE_ENV !== "test") return;
  claimCache.clear();
}

export async function resolveClaimsInTx(
  tx: Prisma.TransactionClient,
  roleIds: string[],
): Promise<Set<string>> {
  if (roleIds.length === 0) return new Set();
  const roleClaims = await tx.roleClaim.findMany({
    where: { roleId: { in: roleIds } },
    include: { claim: { select: { key: true } } },
  });
  const all = new Set<string>();
  for (const rc of roleClaims) {
    all.add(rc.claim.key);
  }
  return all;
}

export async function resolveClaims(roleIds: string[]): Promise<Set<string>> {
  const uncached = roleIds.filter((id) => !claimCache.has(id));

  if (uncached.length > 0) {
    const roleClaims = await prisma.roleClaim.findMany({
      where: { roleId: { in: uncached } },
      include: { claim: { select: { key: true } } },
    });

    const claimsByRole = new Map<string, Set<string>>();
    for (const rc of roleClaims) {
      let set = claimsByRole.get(rc.roleId);
      if (!set) {
        set = new Set();
        claimsByRole.set(rc.roleId, set);
      }
      set.add(rc.claim.key);
    }

    for (const id of uncached) {
      claimCache.set(id, claimsByRole.get(id) ?? new Set());
    }
  }

  const all = new Set<string>();
  for (const id of roleIds) {
    const cached = claimCache.get(id);
    if (cached) {
      for (const key of cached) {
        all.add(key);
      }
    }
  }

  return all;
}

export function invalidateRole(roleId: string): void {
  claimCache.delete(roleId);
}
