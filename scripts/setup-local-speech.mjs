import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

const basePython = process.env.SPEECH_SETUP_PYTHON || "python";
const venv = resolve("work/speech-venv");
const python = resolve(
  venv,
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    windowsHide: true,
    shell: false,
  });
  if (result.error || result.status !== 0) {
    console.error(
      "Speech setup failed. Use Python 3.10–3.12 via SPEECH_SETUP_PYTHON and check internet access.",
    );
    process.exit(1);
  }
}
if (!existsSync(python)) run(basePython, ["-m", "venv", venv]);
run(python, ["-m", "pip", "install", "faster-whisper==1.2.1"]);
run(python, [
  "-c",
  "from faster_whisper.utils import download_model; import sys; download_model('small', output_dir=sys.argv[1])",
  resolve("work/speech-models/small"),
]);
run(python, [
  "-c",
  "from faster_whisper.utils import download_model; import sys; download_model('small.en', output_dir=sys.argv[1])",
  resolve("work/speech-models/small.en"),
]);
console.log(
  "Local English/Hindi speech is ready: small.en for English and small for Hindi. Set SPEECH_PROVIDER=local in .env and restart HELIOS.",
);
