import { spawn } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import {
  codespaceUrls,
  codespaceToolPath,
  configureCodespaceEnvironment,
  workspaceRoot,
} from "./setup-codespace.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const localDirectory = resolve(workspaceRoot, ".local");
const pidPath = resolve(localDirectory, "codespace-runtime.json");
const logPath = resolve(localDirectory, "codespace-runtime.log");
const stopping = process.argv.includes("--stop");
const supervising = process.argv.includes("--supervise");
const delay = (milliseconds) =>
  new Promise((done) => setTimeout(done, milliseconds));

async function processStartTime(pid) {
  const stat = await readFile(`/proc/${pid}/stat`, "utf8");
  return stat
    .slice(stat.lastIndexOf(")") + 2)
    .trim()
    .split(/\s+/)[19];
}

async function currentRuntime() {
  try {
    const runtime = JSON.parse(await readFile(pidPath, "utf8"));
    if (!Number.isSafeInteger(runtime.pid) || runtime.pid <= 1) return null;
    const command = await readFile(`/proc/${runtime.pid}/cmdline`, "utf8");
    if (
      !command.split("\0").includes(scriptPath) ||
      !command.split("\0").includes("--supervise") ||
      runtime.startTime !== (await processStartTime(runtime.pid))
    )
      return null;
    return runtime;
  } catch (error) {
    if (
      ["ENOENT", "ESRCH"].includes(error.code) ||
      error instanceof SyntaxError
    )
      return null;
    throw error;
  }
}

async function removeOwnPid() {
  const runtime = await currentRuntime();
  if (runtime?.pid === process.pid) await unlink(pidPath).catch(() => {});
}

async function supervise() {
  process.env.PATH = codespaceToolPath();
  process.chdir(workspaceRoot);
  await configureCodespaceEnvironment();
  process.loadEnvFile(resolve(workspaceRoot, ".env"));
  if (!process.env.GEMINI_API_KEY?.trim())
    throw new Error(
      "GEMINI_API_KEY is missing; configure the private Codespaces secret or .env and retry.",
    );
  const child = spawn("pnpm", ["run", "dev:v2:services"], {
    cwd: workspaceRoot,
    env: process.env,
    stdio: "inherit",
    detached: true,
  });
  let shuttingDown = false;
  let forceTimer;
  function stopGroup(signal = "SIGTERM") {
    if (!child.pid) return;
    try {
      process.kill(-child.pid, signal);
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
  function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    stopGroup();
    forceTimer = setTimeout(() => {
      stopGroup("SIGKILL");
      removeOwnPid().finally(() => process.exit(1));
    }, 10_000);
  }
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  child.on("error", async (error) => {
    console.error(`HELIOS could not start: ${error.message}`);
    await removeOwnPid();
    process.exitCode = 1;
  });
  child.on("exit", async (code, signal) => {
    clearTimeout(forceTimer);
    stopGroup();
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        process.kill(-child.pid, 0);
      } catch (error) {
        if (error.code === "ESRCH") break;
        throw error;
      }
      await delay(250);
    }
    stopGroup("SIGKILL");
    await removeOwnPid();
    console.log(
      `HELIOS service group stopped (${signal ?? code}). Restart with pnpm codespace:start.`,
    );
    process.exitCode = shuttingDown ? 0 : code || 1;
  });
  await writeFile(
    pidPath,
    JSON.stringify({
      pid: process.pid,
      startTime: await processStartTime(process.pid),
      workspace: workspaceRoot,
    }),
    { mode: 0o600 },
  );
}

async function main() {
  const urls = codespaceUrls();
  process.env.PATH = codespaceToolPath();
  if (process.platform !== "linux")
    throw new Error("The Codespaces supervisor requires Linux process groups.");
  const existing = await currentRuntime();
  if (stopping) {
    if (!existing) {
      console.log("HELIOS is already stopped.");
      return;
    }
    process.kill(existing.pid, "SIGTERM");
    for (let attempt = 0; attempt < 60; attempt++) {
      if (!(await currentRuntime())) {
        console.log("HELIOS stopped.");
        return;
      }
      await delay(250);
    }
    throw new Error(
      "HELIOS is still stopping; inspect .local/codespace-runtime.log.",
    );
  }
  if (existing) {
    console.log(`HELIOS is already running. Patient URL: ${urls.web}`);
    return;
  }
  if (!process.env.GEMINI_API_KEY?.trim()) {
    try {
      const privateEnvironment = parseEnv(
        await readFile(resolve(workspaceRoot, ".env"), "utf8"),
      );
      if (privateEnvironment.GEMINI_API_KEY?.trim())
        process.env.GEMINI_API_KEY = privateEnvironment.GEMINI_API_KEY.trim();
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  if (!process.env.GEMINI_API_KEY?.trim()) {
    console.error(
      "HELIOS did not start: GEMINI_API_KEY is missing. Add it as a GitHub Codespaces secret for HELIOS and restart the Codespace, or set it in this Codespace’s private .env, then run pnpm codespace:start. Setup and database data are preserved.",
    );
    process.exitCode = 1;
    return;
  }
  await mkdir(localDirectory, { recursive: true });
  const descriptor = openSync(logPath, "a", 0o600);
  const supervisor = spawn(
    "flock",
    [
      "--nonblock",
      resolve(localDirectory, "codespace-runtime.lock"),
      process.execPath,
      scriptPath,
      "--supervise",
    ],
    {
      cwd: workspaceRoot,
      env: process.env,
      detached: true,
      stdio: ["ignore", descriptor, descriptor],
    },
  );
  closeSync(descriptor);
  let spawnError;
  supervisor.on("error", (error) => {
    spawnError = error;
  });
  supervisor.unref();
  for (let attempt = 0; attempt < 40; attempt++) {
    if (spawnError) throw spawnError;
    if (await currentRuntime()) {
      console.log(`HELIOS is starting. Patient URL: ${urls.web}`);
      console.log(
        "Runtime log: .local/codespace-runtime.log. Stop with pnpm codespace:stop.",
      );
      return;
    }
    await delay(100);
  }
  throw new Error(
    "Runtime startup failed. Inspect .local/codespace-runtime.log.",
  );
}

(supervising ? supervise() : main()).catch((error) => {
  console.error(`Codespaces runtime: ${error.message}`);
  process.exitCode = 1;
});
