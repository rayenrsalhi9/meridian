import { prisma } from "../db.js";

export interface ClaimCacheStore {
  get(roleId: string): Set<string> | undefined;
  set(roleId: string, claims: Set<string>): void;
  delete(roleId: string): boolean;
}

class InMemoryClaimCache implements ClaimCacheStore {
  private store = new Map<string, Set<string>>();

  get(roleId: string): Set<string> | undefined {
    return this.store.get(roleId);
  }

  set(roleId: string, claims: Set<string>): void {
    this.store.set(roleId, claims);
  }

  delete(roleId: string): boolean {
    return this.store.delete(roleId);
  }
}

export let claimCache: ClaimCacheStore = new InMemoryClaimCache();

export function resetForTests(): void {
  claimCache = new InMemoryClaimCache();
}

export async function resolveClaims(roleIds: string[]): Promise<Set<string>> {
  const uncached = roleIds.filter((id) => !claimCache.get(id));

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
