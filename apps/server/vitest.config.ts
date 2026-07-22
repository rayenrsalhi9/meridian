import { defineConfig } from "vitest/config";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = resolve(__dirname, ".env.test");

if (!existsSync(envPath)) {
  throw new Error(
    `.env.test not found at ${envPath}. Copy .env.test.example to .env.test and configure it.`,
  );
}

config({ path: envPath });

const { DATABASE_URL } = process.env;
if (
  !DATABASE_URL ||
  !DATABASE_URL.includes("localhost:5433") ||
  !DATABASE_URL.includes("meridian_test")
) {
  throw new Error(
    "DATABASE_URL in .env.test must point to localhost:5433/meridian_test for integration tests",
  );
}

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    globalSetup: ["./vitest.global.ts"],
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 15000,
  },
});
