# Meridian

## Prerequisites

- Docker & Docker Compose
- Node.js

## Getting Started (Docker)

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` if you want different values for `POSTGRES_USER`, `POSTGRES_PASSWORD`, or `POSTGRES_DB`.
3. Start the database:
   ```bash
   docker compose up -d
   ```
4. Ensure `apps/server/.env` has a `DATABASE_URL` matching the same `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` values used in the root `.env`. For example:
   ```dotenv
   DATABASE_URL="postgresql://meridian:changeme@localhost:5432/meridian_dev"
   ```
