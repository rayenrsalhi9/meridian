# Meridian

Enterprise intranet MVP — document management, real-time chat, forums, and RBAC. Built as a solo portfolio project following full SDLC methodology.

## Tech Stack

| Layer       | Choice                                                         |
| ----------- | -------------------------------------------------------------- |
| Frontend    | React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui        |
| Backend     | Express 5, TypeScript (tsx dev runner)                         |
| Database    | PostgreSQL 17 via Docker, Prisma 7 ORM                         |
| Auth        | JWT access tokens + httpOnly refresh token rotation            |
| Realtime    | Socket.io (planned for M3)                                     |
| Monorepo    | npm workspaces (`apps/client`, `apps/server`, `packages/shared`) |

## Prerequisites

- Docker & Docker Compose
- Node.js >= 20

## Getting Started

### 1. Database

```bash
cp .env.example .env
docker compose up -d
```

Root `.env` controls `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` for both containers.

### 2. Server

```bash
cp apps/server/.env.example apps/server/.env
# Edit apps/server/.env to match your root .env credentials
npm install
npx prisma migrate deploy  # apply migrations
npx prisma db seed          # create admin user + RBAC seed data
```

The seed creates `admin@meridian.local` / `admin123` (dev default).

### 3. Client

```bash
npm install  # already done if server step ran
```

### 4. Run dev servers

```bash
npm run dev  # starts Vite (port 5173) + tsx watch (port 4000) in parallel
```

Open http://localhost:5173 — Vite proxies `/api` to the Express backend.

## Project Structure

```
meridian/
├── apps/
│   ├── client/            # React 19 SPA (Vite, Tailwind, shadcn)
│   └── server/            # Express 5 API (port 4000)
├── packages/
│   └── shared/            # Zod schemas + TS types consumed by both apps
├── docs/                  # SDLC planning documents
├── docker-compose.yml     # PostgreSQL (dev + test)
└── package.json           # npm workspaces root
```

## Available Commands

| Action            | Command                                          |
| ----------------- | ------------------------------------------------ |
| Dev servers       | `npm run dev`                                    |
| Lint              | `npm run lint` (oxlint)                          |
| Format            | `npm run format` (prettier --write)              |
| Typecheck         | `npm run typecheck`                              |
| Server tests      | `npm run test -w apps/server`                    |
| Server test watch | `npm run test:watch -w apps/server`              |
| Client build      | `npm run build -w apps/client`                   |
| Server build      | `npm run build -w apps/server`                   |

See `AGENTS.md` for detailed conventions, gotchas, and per-workspace configuration.
