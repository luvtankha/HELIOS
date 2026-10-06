import { spawnSync } from "node:child_process";
const moduleName =
  process.argv[2] === "roundtrip"
    ? "helios_voice_bench.live_roundtrip"
    : "helios_voice_bench.live_smoke";
const result = spawnSync(
  "uv",
  [
    "run",
    "--project",
    "voice-service",
    "--no-sync",
    "python",
    "-m",
    moduleName,
  ],
  {
    env: { ...process.env, PYTHONPATH: "voice-service/src" },
    stdio: "inherit",
    windowsHide: true,
  },
);
process.exit(result.status ?? 1);
