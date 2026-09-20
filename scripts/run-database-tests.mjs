import { spawnSync } from "node:child_process";
import { assertTestDatabaseUrl } from "./assert-test-environment.mjs";

process.loadEnvFile(".env");
const url = new URL(process.env.DATABASE_URL ?? "");
url.searchParams.set("schema", "helios_test_regression");
process.env.NODE_ENV = "test";
process.env.TEST_DATABASE_URL = url.toString();
process.env.DATABASE_URL = url.toString();
assertTestDatabaseUrl();
for (const command of [
  "pnpm --filter @helios/api db:migrate",
  "pnpm --filter @helios/api test:integration",
]) {
  const result =
    process.platform === "win32"
      ? spawnSync("cmd.exe", ["/d", "/s", "/c", command], {
          env: process.env,
          stdio: "inherit",
          windowsHide: true,
        })
      : spawnSync("pnpm", command.split(" ").slice(1), {
          env: process.env,
          stdio: "inherit",
        });
  if (result.error || result.status !== 0) process.exit(result.status ?? 1);
}
