import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const childEnv = { ...process.env };
if (!childEnv.JAVA_HOME && process.platform === "win32") {
  const root = join(childEnv.ProgramFiles ?? "C:/Program Files", "Java");
  if (existsSync(root))
    childEnv.JAVA_HOME = readdirSync(root)
      .filter((name) => /^jdk-\d/.test(name))
      .sort((a, b) => Number(b.match(/\d+/)?.[0]) - Number(a.match(/\d+/)?.[0]))
      .map((name) => join(root, name))
      .find((path) => existsSync(join(path, "bin/java.exe")));
}
if (!childEnv.HELIOS_DATABASE_URL && childEnv.DATABASE_URL) {
  const database = new URL(childEnv.DATABASE_URL);
  childEnv.HELIOS_DATABASE_URL = `jdbc:postgresql://${database.hostname}:${database.port || 5432}${database.pathname}`;
  childEnv.HELIOS_DATABASE_USER = decodeURIComponent(database.username);
  childEnv.HELIOS_DATABASE_PASSWORD = decodeURIComponent(database.password);
}
childEnv.HELIOS_VOICE_REQUIRE_BENCHMARK_APPROVAL ??= "false";
if (!childEnv.HELIOS_DATABASE_URL) {
  console.error(
    "Configure DATABASE_URL or HELIOS_DATABASE_URL in the private .env before starting HELIOS.",
  );
  process.exit(1);
}
const windows = process.platform === "win32";
const packaged = process.argv.includes("--packaged");
const backendDirectory = fileURLToPath(
  new URL("../backend-java/", import.meta.url),
);
let command = windows ? "cmd.exe" : "./mvnw";
let args = windows
  ? ["/d", "/s", "/c", "mvnw.cmd spring-boot:run"]
  : ["spring-boot:run"];
if (packaged) {
  const target = join(backendDirectory, "target");
  const jars = existsSync(target)
    ? readdirSync(target).filter((name) =>
        /^helios-patient-api-.*\.jar$/.test(name),
      )
    : [];
  if (jars.length !== 1) {
    console.error(
      "The packaged patient API is missing or ambiguous. Build it first: cd backend-java && " +
        (windows ? ".\\mvnw.cmd clean package" : "./mvnw clean package") +
        ", then run pnpm start from the project root.",
    );
    process.exit(1);
  }
  command = childEnv.JAVA_HOME
    ? join(childEnv.JAVA_HOME, "bin", windows ? "java.exe" : "java")
    : "java";
  args = ["-jar", join(target, jars[0])];
}
const child = spawn(command, args, {
  cwd: backendDirectory,
  env: childEnv,
  stdio: "inherit",
  windowsHide: true,
});
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
