import { execSync } from "node:child_process";

const TEST_DB_MARKER = "meridian_test";
const ALLOWED_DBS = new Set(["meridian_test"]);
const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1"]);

export async function setup(): Promise<void> {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error(
      `DATABASE_URL must contain "${TEST_DB_MARKER}" — refusing to reset a non-test database. Got: (unset)`,
    );
  }

  let dbName: string;
  let host: string;
  try {
    const url = new URL(raw);
    dbName = url.pathname.replace(/^\//, "");
    host = url.hostname;
  } catch {
    throw new Error(
      `DATABASE_URL must contain "${TEST_DB_MARKER}" — refusing to reset a non-test database. Got: (malformed URL)`,
    );
  }

  if (!ALLOWED_DBS.has(dbName) || !ALLOWED_HOSTS.has(host)) {
    throw new Error(
      `DATABASE_URL must contain "${TEST_DB_MARKER}" — refusing to reset a non-test database.`,
    );
  }

  process.stdout.write("Setting up test database...\n");

  execSync("npx prisma migrate reset --force", {
    stdio: "inherit",
    cwd: process.cwd(),
  });

  execSync("npx prisma db seed", {
    stdio: "inherit",
    cwd: process.cwd(),
  });

  process.stdout.write("Test database ready.\n");
}
