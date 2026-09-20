import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const guard = fileURLToPath(
  new URL("../../../scripts/assert-test-environment.mjs", import.meta.url),
);
function run(environment: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [guard], {
    encoding: "utf8",
    env: { ...process.env, TEST_DATABASE_URL: "", ...environment },
  });
}

describe("test database safety guard", () => {
  it("allows the suite to run without database integration", () => {
    const result = run({ NODE_ENV: "test" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("will be skipped");
  });

  it("rejects production, remote and non-test targets", () => {
    expect(
      run({
        NODE_ENV: "production",
        TEST_DATABASE_URL: "postgresql://x:x@localhost/helios_test",
      }).stderr,
    ).toContain("forbidden");
    expect(
      run({
        NODE_ENV: "test",
        TEST_DATABASE_URL: "postgresql://x:x@example.com/helios_test",
      }).stderr,
    ).toContain("local PostgreSQL");
    expect(
      run({
        NODE_ENV: "test",
        TEST_DATABASE_URL: "postgresql://x:x@localhost/helios",
      }).stderr,
    ).toContain("helios_test");
  });

  it("accepts an isolated local PostgreSQL test database", () => {
    const result = run({
      NODE_ENV: "test",
      TEST_DATABASE_URL: "postgresql://x:x@localhost/helios_test_phase19",
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Validated isolated");
  });
});
