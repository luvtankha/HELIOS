import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import { resolve, join, dirname } from "node:path";

if (existsSync(".env")) process.loadEnvFile(".env");
const action = process.argv[2] ?? "start";
if (!["start", "stop", "status"].includes(action))
  throw new Error("Expected start, stop or status");
if (process.env.HELIOS_LOCAL_DATABASE !== "true")
  throw new Error(
    "HELIOS_LOCAL_DATABASE=true is required for the project-local database",
  );
const database = new URL(process.env.DATABASE_URL ?? "");
if (
  database.hostname !== "127.0.0.1" ||
  database.port !== "55435" ||
  database.pathname !== "/helios"
)
  throw new Error("Project-local database requires 127.0.0.1:55435/helios");
const data = resolve(".local/postgres");
const executable = process.platform === "win32" ? ".exe" : "";
let binaryDir = process.env.HELIOS_POSTGRES_BIN;
if (!binaryDir && process.platform === "win32") {
  const installRoot = join(
    process.env.ProgramFiles ?? "C:/Program Files",
    "PostgreSQL",
  );
  if (existsSync(installRoot))
    binaryDir = readdirSync(installRoot)
      .sort((a, b) => Number(b) - Number(a))
      .map((version) => join(installRoot, version, "bin"))
      .find((candidate) => existsSync(join(candidate, `pg_ctl${executable}`)));
}
const env = {
  ...process.env,
  PGPASSWORD: decodeURIComponent(database.password),
};
function run(name, args, allowFailure = false) {
  const result = spawnSync(
    binaryDir ? join(binaryDir, `${name}${executable}`) : name,
    args,
    {
      env,
      encoding: "utf8",
      windowsHide: true,
      // Detached Windows servers can retain pipe handles after pg_ctl exits.
      stdio:
        name === "pg_ctl" && args.includes("start")
          ? ["ignore", "inherit", "inherit"]
          : ["ignore", "pipe", "pipe"],
    },
  );
  if (result.error)
    throw new Error(
      `${name} could not run; install PostgreSQL or set HELIOS_POSTGRES_BIN`,
    );
  if (result.status !== 0 && !allowFailure)
    throw new Error(
      `${name} failed: ${(result.stderr ?? "").replaceAll(env.PGPASSWORD, "[redacted]").trim()}`,
    );
  return result;
}
const initialized = existsSync(join(data, "PG_VERSION"));
if (action !== "start" && !initialized) {
  console.log("Local PostgreSQL is not initialized");
  process.exit(0);
}
if (action === "status") {
  console.log(
    run("pg_ctl", ["-D", data, "status"], true).status === 0
      ? "Local PostgreSQL is running"
      : "Local PostgreSQL is stopped",
  );
  process.exit(0);
}
if (action === "stop") {
  if (run("pg_ctl", ["-D", data, "status"], true).status === 0)
    run("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
  console.log("Local PostgreSQL is stopped");
  process.exit(0);
}
if (!initialized) {
  mkdirSync(dirname(data), { recursive: true });
  const passwordFile = resolve(".local/database-init-password");
  writeFileSync(passwordFile, `${env.PGPASSWORD}\n`, { mode: 0o600 });
  try {
    run("initdb", [
      "-D",
      data,
      "-U",
      decodeURIComponent(database.username),
      "--encoding=UTF8",
      "--auth=scram-sha-256",
      `--pwfile=${passwordFile}`,
    ]);
  } finally {
    unlinkSync(passwordFile);
  }
}
if (run("pg_ctl", ["-D", data, "status"], true).status !== 0)
  run("pg_ctl", [
    "-D",
    data,
    "-l",
    resolve(".local/postgres.log"),
    "-o",
    "-h 127.0.0.1 -p 55435",
    "-w",
    "start",
  ]);
const found = run("psql", [
  "-h",
  "127.0.0.1",
  "-p",
  "55435",
  "-U",
  decodeURIComponent(database.username),
  "-d",
  "postgres",
  "-tAc",
  "SELECT 1 FROM pg_database WHERE datname='helios'",
]);
if (found.stdout.trim() !== "1")
  run("createdb", [
    "-h",
    "127.0.0.1",
    "-p",
    "55435",
    "-U",
    decodeURIComponent(database.username),
    "helios",
  ]);
console.log(
  "HELIOS local database ready on 127.0.0.1:55435; credentials remain private.",
);
