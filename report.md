# Pre-PR Audit — Authentication Epic

## 1. `apps/server/.env` — gitignored status

Confirmed tracked. Root `.gitignore` includes `.env` on line 3. `apps/server/.env` does not appear in `git status` (neither modified nor untracked). No risk of accidental commit.

## 2. Refresh token reuse — no theft-detection

Code path: `apps/server/src/lib/auth.ts:64-83`

```ts
const existing = await prisma.refreshToken.findFirst({
  where: { tokenHash: oldHash, revokedAt: null, expiresAt: { gt: new Date() } },
});
if (!existing) return null;
```

When a **revoked** token is presented again:

- `findFirst` returns `null` (`revokedAt` is not null)
- `rotateRefreshToken` returns `null`
- Route returns **401**
- **No mass revocation** — other active refresh tokens for that userId remain valid

The industry-standard theft-detection pattern (revoke all sessions for userId when a revoked token is reused) is **not implemented**.

## 3. `.env.example` — JWT_SECRET comment is weaker

Current JWT_SECRET entry:

```
# JWT signing secret — required in all environments
JWT_SECRET="change-me-to-a-strong-random-secret"
```

Says it's required but does **not** explicitly warn that the placeholder must be replaced outside development. Compare with the ADMIN_INITIAL_PASSWORD comment which explains the dev vs production behavior. The JWT_SECRET comment would benefit from similar explicitness, e.g.:

```
# JWT signing secret — required in all environments.
# WARNING: the value below is a dev placeholder; replace with a strong
# random secret in any non-development environment.
```

## 4. Files staged for commit

**Modified (tracked):**
- `.gitignore`
- `apps/server/.env.example`
- `apps/server/package.json`
- `apps/server/prisma/schema.prisma`
- `apps/server/src/index.ts`
- `package-lock.json`

**New (untracked):**
- `apps/server/prisma/migrations/20260719062726_add_refresh_tokens/`
- `apps/server/src/__tests__/`
- `apps/server/src/app.ts`
- `apps/server/src/lib/`
- `apps/server/src/middleware/`
- `apps/server/src/routes/`
- `apps/server/vitest.config.ts`
- `packages/`

No `.env` files. No client files.
