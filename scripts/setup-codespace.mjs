import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmod, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { delimiter, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

export const workspaceRoot = fileURLToPath(new URL("../", import.meta.url));
const privateEnvPath = resolve(workspaceRoot, ".env");
const uvVersion = "0.12.18";

export function codespaceToolPath(
  environment = process.env,
  userHome = homedir(),
) {
  return [
    ...new Set([
      ...(environment.PIPX_BIN_DIR ? [environment.PIPX_BIN_DIR] : []),
      resolve(userHome, ".local/bin"),
      ...(environment.PATH ?? "").split(delimiter).filter(Boolean),
    ]),
  ].join(delimiter);
}

export function codespaceToolEnvironment(
  environment = process.env,
  userHome = homedir(),
) {
  const userTools = {
    PIPX_HOME: resolve(userHome, ".local/share/pipx"),
    PIPX_BIN_DIR: resolve(userHome, ".local/bin"),
  };
  return {
    ...userTools,
    PATH: codespaceToolPath({ ...environment, ...userTools }, userHome),
  };
}

export function codespaceUrls(environment = process.env) {
  const name = environment.CODESPACE_NAME;
  const domain = environment.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
  if (
    environment.CODESPACES !== "true" ||
    !/^[a-z0-9-]+$/.test(name ?? "") ||
    !/^[a-z0-9.-]+$/.test(domain ?? "")
  ) {
    throw new Error("Run this command inside a GitHub Codespace for HELIOS.");
  }
  return {
    web: `https://${name}-3000.${domain}`,
    api: `https://${name}-8080.${domain}`,
    voice: `https://${name}-9090.${domain}`,
  };
}

function run(command, args, environment = process.env) {
  const result = spawnSync(command, args, {
    cwd: workspaceRoot,
    env: environment,
    stdio: "inherit",
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `${command} failed. Check its output above and retry setup.`,
    );
}

export function buildCodespaceEnvironment(
  previousText,
  urls,
  databasePassword,
) {
  const previous = parseEnv(previousText);
  if (!/^[a-f0-9]{64}$/.test(databasePassword))
    throw new Error(
      "The PostgreSQL sidecar has not created its private password.",
    );

  const configured = {
    HELIOS_LOCAL_DATABASE: "false",
    DATABASE_URL: `postgresql://helios:${databasePassword}@database:5432/helios`,
    HELIOS_FLYWAY_ENABLED: "true",
    HELIOS_FLYWAY_BASELINE_ON_MIGRATE: "false",
    HELIOS_ALLOWED_ORIGINS: urls.web,
    WEB_ORIGIN: urls.web,
    NEXT_PUBLIC_API_URL: urls.api,
    NEXT_PUBLIC_PATIENT_API_V2_URL: urls.api,
    NEXT_PUBLIC_VOICE_RUNTIME_URL: urls.voice,
    NEXT_PUBLIC_DEMO_MODE: "false",
    HELIOS_PATIENT_API_URL: "http://127.0.0.1:8080",
    HELIOS_VOICE_RUNTIME_URI: "http://127.0.0.1:9090",
    HELIOS_VOICE_PUBLIC_URI: urls.voice,
    HELIOS_VOICE_PROVIDER: "gemini-live",
    HELIOS_VOICE_HOST: "0.0.0.0",
    SERVER_ADDRESS: "0.0.0.0",
    HELIOS_VOICE_REQUIRE_BENCHMARK_APPROVAL: "false",
    ENABLE_DEMO_MODE: "false",
    DEMO_MODE: "false",
  };
  for (const key of [
    "SESSION_TOKEN_SECRET",
    "HELIOS_VOICE_RUNTIME_SECRET",
    "HELIOS_VOICE_CONTROL_SECRET",
  ]) {
    configured[key] = previous[key] || randomBytes(48).toString("base64url");
  }
  configured.HELIOS_GEMINI_LIVE_MODEL =
    previous.HELIOS_GEMINI_LIVE_MODEL || "gemini-3.8-live";

  const managedKeys = new Set(Object.keys(configured));
  const generatedComments = new Set([
    "# Private Codespaces configuration. Never commit this file.",
    "# GEMINI_API_KEY is inherited from the GitHub Codespaces secret.",
  ]);
  const preservedLines = previousText
    .split(/\r?\n/)
    .filter(
      (line) =>
        !managedKeys.has(line.match(/^\s*([A-Z0-9_]+)\s*=/)?.[1]) &&
        !generatedComments.has(line),
    );
  return [
    "# Private Codespaces configuration. Never commit this file.",
    "# GEMINI_API_KEY is inherited from the GitHub Codespaces secret.",
    ...preservedLines.filter((line) => line.trim()),
    ...Object.entries(configured).map(([key, value]) => `${key}=${value}`),
    "",
  ].join("\n");
}

export async function configureCodespaceEnvironment() {
  const urls = codespaceUrls();
  const ignored = spawnSync("git", ["check-ignore", ".env"], {
    cwd: workspaceRoot,
    stdio: "ignore",
  });
  if (ignored.status !== 0)
    throw new Error("The private .env must be ignored by Git before setup.");
  let previousText = "";
  try {
    previousText = await readFile(privateEnvPath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const databasePassword = (
    await readFile("/run/helios-db-secrets/password", "utf8")
  ).trim();
  const nextText = buildCodespaceEnvironment(
    previousText,
    urls,
    databasePassword,
  );
  if (nextText !== previousText)
    await writeFile(privateEnvPath, nextText, { mode: 0o600 });
  await chmod(privateEnvPath, 0o600);
  return urls;
}

export async function setupCodespace() {
  codespaceUrls();
  Object.assign(process.env, codespaceToolEnvironment());
  const manifest = JSON.parse(
    await readFile(resolve(workspaceRoot, "package.json"), "utf8"),
  );
  if (!/^pnpm@\d+\.\d+\.\d+$/.test(manifest.packageManager ?? ""))
    throw new Error("package.json must pin an exact pnpm version.");
  const expectedPnpm = manifest.packageManager.slice(5);
  const installedPnpm = spawnSync("pnpm", ["--version"], { encoding: "utf8" });
  if (
    installedPnpm.status !== 0 ||
    installedPnpm.stdout.trim() !== expectedPnpm
  )
    run("npm", ["install", "--global", manifest.packageManager]);
  const installedUv = spawnSync("uv", ["--version"], { encoding: "utf8" });
  if (
    installedUv.status !== 0 ||
    !installedUv.stdout.startsWith(`uv ${uvVersion} `)
  )
    run("pipx", ["install", "--force", `uv==${uvVersion}`]);

  const urls = await configureCodespaceEnvironment();
  await chmod(resolve(workspaceRoot, "backend-java/mvnw"), 0o755);
  run("pnpm", ["install", "--frozen-lockfile"]);
  run("pnpm", ["--filter", "@helios/shared", "build"]);
  run("uv", [
    "sync",
    "--project",
    "voice-service",
    "--locked",
    "--no-install-project",
    "--python",
    "3.12",
  ]);
  console.log(`HELIOS setup complete. Patient URL: ${urls.web}`);
  const privateEnvironment = parseEnv(await readFile(privateEnvPath, "utf8"));
  if (
    !process.env.GEMINI_API_KEY?.trim() &&
    !privateEnvironment.GEMINI_API_KEY?.trim()
  ) {
    console.log(
      "Voice startup is blocked: add GEMINI_API_KEY in GitHub Settings → Codespaces → Secrets, allow HELIOS, then restart the Codespace, or set it in this Codespace’s private .env. No key is written to tracked files.",
    );
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  setupCodespace().catch((error) => {
    console.error(`Codespaces setup: ${error.message}`);
    process.exitCode = 1;
  });
}
