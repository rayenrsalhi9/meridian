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

config({ path: envPath, override: true });

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set after loading .env.test");
}

let parsed: URL;
try {
  parsed = new URL(DATABASE_URL);
} catch {
  throw new Error(
    `DATABASE_URL in .env.test is not a valid URL: ${DATABASE_URL}`,
  );
}

if (
  parsed.hostname !== "localhost" ||
  parsed.port !== "5433" ||
  parsed.pathname !== "/meridian_test"
) {
  throw new Error(
    `DATABASE_URL in .env.test must be postgresql://USER:PASS@localhost:5433/meridian_test, got ${parsed.hostname}:${parsed.port}${parsed.pathname}`,
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
