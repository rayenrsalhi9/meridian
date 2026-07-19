# CodeRabbit self-check report

## CHECK 1: Privilege escalation — POST/PUT `roleIds` gating

### Point 1 — Exact gating code

**POST** (`apps/server/src/routes/users.ts:57-61`):
```typescript
router.post("/", requireAuth, requireClaim("USER_MANAGE"), requireClaim("ROLE_MANAGE"), async (req, res) => {
```
Unconditional — `createUserSchema` always requires `roleIds`, so always requires `ROLE_MANAGE`.

**PUT** (`apps/server/src/routes/users.ts:81-85`):
```typescript
router.put("/:id", requireAuth, requireClaim("USER_MANAGE"), async (req, res, next) => {
  if (req.body.roleIds !== undefined) {
    return requireClaim("ROLE_MANAGE")(req, res, next);
  }
  next();
}, async (req, res) => {
```
Conditional — checks `ROLE_MANAGE` only when `roleIds` is present in body. Calls `requireClaim(...)` which sends 403 with `"Insufficient permissions"` and does **not** call `next()`. The handler never runs.

### Point 2 — PUT trace (USER_MANAGE only, sends roleIds)

→ **Explicit 403 rejection.** The middleware chain stops at the conditional check. The handler never executes. No side effects, no silent dropping. Response body: `{"error":"Insufficient permissions"}`.

### Point 3 — POST trace (USER_MANAGE only)

→ **Explicit 403 rejection.** `requireClaim("ROLE_MANAGE")` fires first as a separate middleware in the chain. Handler never runs.

### Point 4 — ANY roleIds triggers the gate

The gate is `req.body.roleIds !== undefined` — it does **not** inspect the content of the array. Whether you pass `["admin-role-id"]`, `["editor-role-id"]`, or `[]` (empty array), the presence alone triggers the ROLE_MANAGE requirement. This is correct because even a non-admin role today could be augmented with admin claims tomorrow by someone with ROLE_MANAGE.

### Point 5 — Test coverage

The existing test `"rejects role assignment in PUT without ROLE_MANAGE (privilege escalation)"` at `admin.test.ts:648` sends `roleIds: [ROLE_ID_2]` where `ROLE_ID_2` is an **Editor** role (DOCUMENT_CREATE claim — not admin), and expects 403. This already covers the "any roleIds, not just admin" case explicitly.

---

## CHECK 2: Last-admin invariant — `ensureOtherAdminExists`

### Shared helper

`apps/server/src/services/user.service.ts:17-60`:
```typescript
export async function ensureOtherAdminExists(
  userIdsPotentiallyLosingAdmin: string[],
  tx?: {
    user: {
      findMany(args: {...}): Promise<Array<Record<string, unknown>>>;
    };
  },
): Promise<string | null> {
  if (userIdsPotentiallyLosingAdmin.length === 0) return null;
  const client = tx ?? prisma;
  const rows = (await client.user.findMany({
    where: { id: { notIn: userIdsPotentiallyLosingAdmin }, isActive: true },
    select: { id: true, userRoles: { select: { roleId: true } } },
  })) as Array<...> ?? [];
  for (const user of rows) {
    const roleIds = user.userRoles.map(ur => ur.roleId);
    if (roleIds.length > 0) {
      const claims = await resolveClaims(roleIds);
      for (const claim of ADMIN_CLAIMS) {
        if (claims.has(claim)) return null;
      }
    }
  }
  return LAST_ADMIN_ERROR;
}
```

### All three call sites use the same helper

| Call site | File | Uses `ensureOtherAdminExists`? |
|---|---|---|
| `deactivateUser` | `user.service.ts:245` | Yes (`tx` passed) |
| `updateUser` | `user.service.ts:171` | Yes (`tx` passed) |
| `updateRole` | `role.service.ts:150` | Yes (`tx` passed) |

All three call the same exported helper, not three separate reimplementations.

### Admin status via resolved claims, not role names

`ADMIN_CLAIMS = new Set(["ROLE_MANAGE", "USER_MANAGE"])` at `user.service.ts:7`. These are **claim keys** resolved through `resolveClaims()` which traverses `roleClaim → claim.key` mappings. No `role.name === 'Admin'` string matching anywhere. Any role, regardless of name, that carries `ROLE_MANAGE` or `USER_MANAGE` via its `roleClaims` counts as admin.

### Two-admins scenario trace

- 2 admins (A, B), deactivating A: `ensureOtherAdminExists([A], tx)` queries other active users NOT in `[A]`. Finds B with admin claims → returns `null` (safe) → deactivation proceeds. ✓
- 1 admin (A), deactivating A: `ensureOtherAdminExists([A], tx)` queries other active users NOT in `[A]`. No results (or results without admin claims) → returns `LAST_ADMIN_ERROR` → blocked. ✓

### `updateRole` path has its own test

Test `"blocks removing admin claims from role when it would leave zero admins"` at `admin.test.ts:338` covers:
- Role holds `ROLE_MANAGE + USER_MANAGE` (ADMIN_CLAIMS)
- New claims are `[DOCUMENT_CREATE]` (non-admin)
- Two users have this role, and their other roles don't provide admin claims
- No other active user has admin claims
- Result: 400 with `LAST_ADMIN_ERROR`. ✓

### TOCTOU verification

| Path | Check + mutation in same `$transaction`? |
|---|---|
| `deactivateUser` | **Yes** — entire function body wrapped in `prisma.$transaction(async (tx) => {...})`. User reads through `tx`. |
| `updateUser` | **Yes** — moved the `ensureOtherAdminExists` call inside the transaction (was outside before this self-check). |
| `updateRole` | **Yes** — entire function body moved inside the transaction (was split before this self-check). |

All three have the admin-count check and the mutation inside the same `prisma.$transaction` callback, with user reads going through the `tx` client. `resolveClaims()` still uses global Prisma for role/claim reads, but those tables aren't modified in any of these transactions, so there's no TOCTOU concern there.

---

## Gaps found and fixed

1. **`deactivateUser`** had inline duplicate of the admin check — refactored to call shared `ensureOtherAdminExists`.
2. **`updateUser`** and **`updateRole`** had the check **before** the transaction — moved inside the transaction.
3. **`ensureOtherAdminExists`** signature updated to accept optional `tx` client parameter.

## Delete role last-admin protection (now fixed)

### Fix

**`apps/server/src/services/role.service.ts:187-226`** — `deleteRole` now:
1. Finds all active users assigned to the role being deleted
2. For each such user, checks whether their **other** roles (not the one being deleted) grant `ADMIN_CLAIMS` (`ROLE_MANAGE` / `USER_MANAGE`)
3. Collects user IDs that **would** lose their only source of admin access
4. Calls `ensureOtherAdminExists(losingAdmin, tx)` inside the same `$transaction`
5. If the helper returns `LAST_ADMIN_ERROR`, the transaction returns `{ error }` without performing any deletion — **no partial cascade**
6. Otherwise, proceeds with `userRole.deleteMany`, `roleClaim.deleteMany`, `role.delete` as before

**`apps/server/src/routes/roles.ts:95`** — Route handler now differentiates 404 (`"Role not found"`) from 400 (last-admin error).

### Tests

**Negative** (`admin.test.ts:411`): ADMIN_ROLE_ID (with `ROLE_MANAGE` + `USER_MANAGE`) is the only role granting admin claims, assigned to a single active user. DELETE returns 400 with `LAST_ADMIN_ERROR`. Asserts `role.delete`, `userRole.deleteMany`, `roleClaim.deleteMany` were **never** called — nothing partially deleted.

**Positive** (`admin.test.ts:442`): ADMIN_ROLE_ID is deleted, but another active user independently holds `ROLE_MANAGE` through a different role (ROLE_ID_2). DELETE returns 204. Asserts cascade deletion occurred.
