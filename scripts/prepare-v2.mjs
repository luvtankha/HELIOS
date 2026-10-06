import { spawnSync } from "node:child_process";

if (process.env.HELIOS_LOCAL_DATABASE === "true") {
  const result = spawnSync(
    process.execPath,
    ["scripts/local-postgres.mjs", "start"],
    { stdio: "inherit", env: process.env, windowsHide: true },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const sync = spawnSync(
  "uv",
  ["sync", "--project", "voice-service", "--no-install-project"],
  { stdio: "inherit", env: process.env, windowsHide: true },
);
if (sync.error || sync.status !== 0) {
  console.error(
    "Voice dependencies could not be installed. Install uv and Python 3.12.",
  );
  process.exit(1);
}
