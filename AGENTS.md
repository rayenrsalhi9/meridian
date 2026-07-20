# Meridian — Agent Guide

Early-stage full-stack monorepo (npm workspaces) — React/Vite client + Express/Prisma server. PostgreSQL 17 via Docker.

## Commands (run from root)

| Action       | Command                                                         |
| ------------ | --------------------------------------------------------------- |
| Dev servers  | `npm run dev` (parallel: Vite + tsx watch)                      |
| Lint         | `npm run lint` (oxlint)                                         |
| Format       | `npm run format` (prettier --write)                             |
| Typecheck    | `npm run typecheck` (runs per-workspace `typecheck` if present) |
| Client build | `npm run build -w apps/client`                                  |
| Server build | `npm run build -w apps/server` (runs `prisma generate && tsc`)  |

No tests configured yet. No CI yet.

## Monorepo layout

```
apps/client/   — React 19 SPA (Vite, Tailwind v4, shadcn/ui, React Router 8)
apps/server/   — Express 5 API (tsx dev runner, port 4000)
packages/shared/ — placeholder for types/Zod schemas (empty)
docs/          — SDLC planning docs (useful for understanding planned architecture)
```

## Server (apps/server)

- **Entry:** `src/index.ts`, port defaults to `4000`
- **Prisma schema:** `prisma/schema.prisma`
- **Prisma config:** `prisma.config.ts` (v7 custom config file, not `prisma/schema.prisma` default path)
- **Prisma client output:** `src/generated/prisma/` (non-standard path — set in schema `output`)
- **Postinstall hook:** `prisma generate` runs automatically on `npm install`
- **DB connection:** `src/db.ts` uses `@prisma/adapter-pg` with `DATABASE_URL` env var
- **Migration commands:** `npx prisma migrate dev` (dev), `npx prisma migrate deploy` (prod)
- `.env` lives in `apps/server/.env` (not root)

## Client (apps/client)

- **Entry:** `src/main.tsx` (BrowserRouter), root component `App.tsx`
- **Path alias:** `@/*` → `src/*`
- **shadcn/ui style:** `base-vega`, icons: lucide
- **Deprecated imports:** Do NOT use `@/components/ui/button` from `shadcn` package registry. The only existing UI component is `src/components/ui/button.tsx` written with `@base-ui/react` + CVA.
- **Tailwind:** v4 (no config file, plugin-based via `@tailwindcss/vite`)

## Key conventions & gotchas

- **Two TypeScript versions:** client `~6.0.2`, server `^7.0.2` — do not unify them.
- **Prisma output** goes to `src/generated/prisma/`, not default `node_modules/.prisma`. The generated client entry is `src/generated/prisma/client.ts`, imported via relative path with `.js` extension per ESM conventions (e.g., `"./generated/prisma/client.js"`).
- **Server enforces `"type": "module"`** — use ESM imports with `.js` extensions (e.g., `import { prisma } from "./db.js"`).
- **No Zod/validation yet** — planned for `packages/shared`.
- **No auth, no WebSocket, no real features** — project in M0 scaffolding phase. Check `docs/` for planned architecture.
- The only database table is `HealthCheck`. Future schema is planned in `docs/03-system-design.md`.
- Adding new shadcn/ui components: use `npx shadcn add <component>` in `apps/client/`.
