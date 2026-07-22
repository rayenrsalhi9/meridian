# Meridian — Agent Guide

Early-stage full-stack monorepo (npm workspaces) — React/Vite client + Express/Prisma server with JWT auth and RBAC. PostgreSQL 17 via Docker.

## Commands (run from root)

| Action       | Command                                                    |
| ------------ | ---------------------------------------------------------- |
| Dev servers  | `npm run dev` (parallel: Vite + tsx watch)                 |
| Lint         | `npm run lint` (oxlint, from root)                         |
| Format       | `npm run format` (prettier --write)                        |
| Typecheck    | `npm run typecheck` (per-workspace `typecheck` if present) |
| Server tests | `npm run test -w apps/server` (`vitest run`, 15s timeout)  |
| Server t:w   | `npm run test:watch -w apps/server`                        |
| Client build | `npm run build -w apps/client` (`tsc -b && vite build`)    |
| Server build | `npm run build -w apps/server` (`prisma generate && tsc`)  |

No client tests yet. No CI yet.

## Monorepo layout

```
apps/client/   — React 19 SPA (Vite, Tailwind v4 w/ @tailwindcss/vite, shadcn/ui, React Router 8)
apps/server/   — Express 5 API (tsx dev runner, port 4000)
packages/shared/ — Zod schemas + types for auth, users, roles, claims (importable as "shared")
docs/          — SDLC planning docs useful for understanding planned architecture
```

## Server (apps/server)

- **Entry:** `src/index.ts`, port defaults to `4000` (env `PORT`)
- **Prisma schema:** `prisma/schema.prisma`
- **Prisma config:** `prisma.config.ts` (v7 custom config file, not default path)
- **Prisma client output:** `src/generated/prisma/` (non-standard — set in schema `output`)
- **Postinstall hook:** `prisma generate` runs automatically on `npm install`
- **DB connection:** `src/db.ts` uses `@prisma/adapter-pg` with `DATABASE_URL` env var
- **Seed:** `npx prisma db seed` (uses `prisma/seed.ts`, creates admin user + RBAC seed data)
- **Migration commands:** `npx prisma migrate dev` (dev), `npx prisma migrate deploy` (prod)
- `.env` lives in `apps/server/.env` (not root)
- **API prefix:** `/api/v1` for auth/users/roles/claims; `/api/health` for health check
- **Auth:** JWT access tokens (15m) + httpOnly refresh token cookies (7d rotation, with revocation/grace period)
- **RBAC:** `User` ↔ `UserRole` ↔ `Role` ↔ `RoleClaim` ↔ `Claim` — 6 tables, 6 migrations applied
- **Middleware:** `requireAuth` (JWT verification), `requireClaim` (claim-based guard)

## Client (apps/client)

- **Entry:** `src/main.tsx` (BrowserRouter), root component `App.tsx`
- **Path alias:** `@/*` → `src/*`
- **shadcn/ui style:** `base-vega`, icons: lucide
- **Tailwind:** v4 (no config file, `@tailwindcss/vite` plugin, `shadcn/tailwind.css`)
- **Vite proxy:** `/api` → `http://localhost:4000` (dev only)
- **Auth:** `AuthContext` + `api-client.ts` (in-memory access token, auto-refresh via cookie, `credentials: "include"`)
- **Pages:** login, profile, admin users, admin roles, plus PlaceholderPage for future routes
- **Deprecated imports:** Do NOT use `@/components/ui/button` from shadcn package registry. The only existing UI component is `src/components/ui/button.tsx` written with `@base-ui/react` + CVA.
- Adding new shadcn/ui components: `npx shadcn add <component>` in `apps/client/`

## packages/shared

- Workspace package `"shared"` — importable as `"shared"` from any workspace
- Exports Zod schemas and TypeScript types for login, change/reset password, create/update user, create/update role, and claim constants
- No internal `tsc` build — consumed directly from `.ts` source via workspace resolution

## Key conventions & gotchas

- **Two TypeScript versions:** client `~6.0.2` (Vite constraint), server `^7.0.2` — do not unify them.
- **Server enforces `"type": "module"`** — all imports use `.js` extensions even for `.ts` files (e.g. `import { prisma } from "./db.js"`).
- **Prisma output** is at `src/generated/prisma/client.js` (not default path). Import with `.js` extension per ESM conventions.
- **Tests:** Server uses `vitest` + `supertest`. Integration tests (`auth.test.ts`) hit a real DB and expect seeded data. Unit tests (`admin.test.ts`, etc.) mock `db.js`. The integration test user `admin@meridian.local` / `admin123` is created by the seed script.
- **DB config:** Root `.env` provides `POSTGRES_*` for Docker Compose; `apps/server/.env` provides `DATABASE_URL` and `JWT_SECRET`. Both must stay in sync.
- **`packages/shared`** has no build step — its `main` and `exports` point directly at `./src/index.ts`. Workspace consumers import raw TypeScript.
- **Client lint** uses its own `.oxlintrc.json` with React plugin rules (root lint omits those).
- No CI, no pre-commit hooks, no release process yet.
