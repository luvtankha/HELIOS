import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const allowed = new Set([
  "routing:seed:direct",
  "dev:services",
  "start:services",
  "db:migrate:direct",
  "demo:seed:direct",
  "demo:reset:direct",
  "demo:verify:direct",
  "test:e2e:connected:direct",
]);
const target = process.argv[2];

if (!allowed.has(target) || process.argv.length !== 3) {
  console.error("Expected one allowlisted HELIOS demo command.");
  process.exit(2);
}

const localEnv = resolve(process.cwd(), ".env");
if (!existsSync(localEnv)) {
  console.error("Create the ignored root .env before running demo commands.");
  process.exit(2);
}
if (typeof process.loadEnvFile !== "function") {
  console.error("Demo environment loading requires Node.js 20.12 or newer.");
  process.exit(2);
}
process.loadEnvFile(localEnv);

let databaseUrl;
try {
  databaseUrl = new URL(process.env.DATABASE_URL ?? "");
} catch {
  console.error("DATABASE_URL in .env is not a valid URL.");
  process.exit(2);
}

if (
  !["postgresql:", "postgres:"].includes(databaseUrl.protocol) ||
  !["localhost", "127.0.0.1", "[::1]"].includes(databaseUrl.hostname)
) {
  console.error("Demo commands require a local PostgreSQL URL.");
  process.exit(2);
}

databaseUrl.pathname = "/helios_sih_demo";
process.env.DATABASE_URL = databaseUrl.toString();
process.env.NODE_ENV = "development";
process.env.ALLOW_DEMO_SEED = "true";
process.env.DEMO_MODE = "true";
process.env.ENABLE_DEMO_MODE = "true";
process.env.NEXT_PUBLIC_DEMO_MODE = "true";
process.env.STORAGE_PATH = resolve(
  process.cwd(),
  "work",
  "sih-demo-private-uploads",
);

const windows = process.platform === "win32";
const child = spawn(
  windows ? "cmd.exe" : "pnpm",
  windows ? ["/d", "/s", "/c", `pnpm run ${target}`] : ["run", target],
  { env: process.env, stdio: "inherit" },
);

child.on("error", (error) => {
  console.error(`Unable to launch pnpm: ${error.message}`);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});
