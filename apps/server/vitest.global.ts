import { execSync } from "node:child_process";

const TEST_DB_MARKER = "meridian_test";

export async function setup(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || !dbUrl.includes(TEST_DB_MARKER)) {
    throw new Error(
      `DATABASE_URL must contain "${TEST_DB_MARKER}" — refusing to reset a non-test database. Got: ${dbUrl ?? "(unset)"}`,
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
