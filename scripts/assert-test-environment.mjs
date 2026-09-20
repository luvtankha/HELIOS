import { pathToFileURL } from "node:url";

export function assertTestDatabaseUrl(environment = process.env) {
  const value = environment.TEST_DATABASE_URL;
  if (!value) return { configured: false };
  if (environment.NODE_ENV === "production")
    throw new Error("Test database commands are forbidden in production");
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL URL");
  }
  const database = url.pathname.slice(1).toLowerCase();
  const schema = (url.searchParams.get("schema") ?? "").toLowerCase();
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !local)
    throw new Error("Integration tests require local PostgreSQL");
  if (!database.startsWith("helios_test") && !schema.startsWith("helios_test"))
    throw new Error(
      "Integration tests require a helios_test database or schema",
    );
  return { configured: true, database, schema };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const result = assertTestDatabaseUrl();
  console.log(
    result.configured
      ? "Validated isolated local test database."
      : "TEST_DATABASE_URL is not configured; database integration tests will be skipped.",
  );
}
