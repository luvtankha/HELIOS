export function assertDemoSeedAllowed(environment: NodeJS.ProcessEnv) {
  if (environment.NODE_ENV === "production")
    throw new Error("Demo seed/reset is forbidden in production");
  if (environment.ALLOW_DEMO_SEED !== "true")
    throw new Error("Set ALLOW_DEMO_SEED=true explicitly for demo seed/reset");
  if (
    environment.DEMO_MODE !== "true" ||
    environment.ENABLE_DEMO_MODE !== "true"
  )
    throw new Error(
      "Demo seed/reset requires DEMO_MODE=true and ENABLE_DEMO_MODE=true",
    );
  const databaseUrl = environment.DATABASE_URL ?? "";
  let demoDatabase = false;
  try {
    const parsed = new URL(databaseUrl);
    demoDatabase =
      ["postgresql:", "postgres:"].includes(parsed.protocol) &&
      ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) &&
      (parsed.pathname.slice(1).toLowerCase().startsWith("helios_demo") ||
        parsed.pathname.slice(1).toLowerCase().startsWith("helios_sih_demo") ||
        (parsed.searchParams.get("schema") ?? "")
          .toLowerCase()
          .startsWith("helios_demo"));
  } catch {
    demoDatabase = false;
  }
  if (!demoDatabase)
    throw new Error(
      "Demo seed/reset requires local PostgreSQL and a helios_demo/helios_sih_demo database or helios_demo schema",
    );
}
