import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const allowed = new Set([
  "routing:seed:direct",
  "dev:services",
  "start:services",
  "db:migrate:direct",
  "db:check:direct",
]);
const target = process.argv[2];

if (!allowed.has(target) || process.argv.length !== 3) {
  console.error("Expected one allowlisted HELIOS local command.");
  process.exit(2);
}

const localEnv = resolve(process.cwd(), ".env");
if (existsSync(localEnv) && process.env.NODE_ENV !== "production") {
  if (typeof process.loadEnvFile !== "function") {
    console.error("Local .env loading requires Node.js 20.12 or newer.");
    process.exit(2);
  }
  process.loadEnvFile(localEnv);
}

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
  if (signal) {
    console.error(`HELIOS command ended with signal ${signal}`);
    process.exitCode = 1;
  } else {
    process.exitCode = code ?? 1;
  }
});
