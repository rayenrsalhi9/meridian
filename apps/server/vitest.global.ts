import { execSync } from "node:child_process";

export async function setup(): Promise<void> {
  process.stdout.write("Setting up test database...\n");

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    cwd: process.cwd(),
  });

  execSync("npx prisma db seed", {
    stdio: "inherit",
    cwd: process.cwd(),
  });

  process.stdout.write("Test database ready.\n");
}
