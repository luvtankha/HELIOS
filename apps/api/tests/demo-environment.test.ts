import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { assertDemoSeedAllowed } from "../prisma/demo-guard.js";

describe("synthetic demo environment", () => {
  it("refuses reset or seed in production regardless of flags", () => {
    expect(() =>
      assertDemoSeedAllowed({
        NODE_ENV: "production",
        ALLOW_DEMO_SEED: "true",
        DEMO_MODE: "true",
        ENABLE_DEMO_MODE: "true",
        DATABASE_URL: "postgresql://demo:demo@localhost/helios_demo",
      }),
    ).toThrow("forbidden in production");
  });

  it("requires explicit operator consent and a demo-named database/schema", () => {
    expect(() =>
      assertDemoSeedAllowed({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://local:local@localhost/helios_demo",
      }),
    ).toThrow("ALLOW_DEMO_SEED");
    expect(() =>
      assertDemoSeedAllowed({
        NODE_ENV: "development",
        ALLOW_DEMO_SEED: "true",
        DEMO_MODE: "true",
        ENABLE_DEMO_MODE: "true",
        DATABASE_URL: "postgresql://local:local@localhost/helios",
      }),
    ).toThrow("local PostgreSQL");
    expect(() =>
      assertDemoSeedAllowed({
        NODE_ENV: "development",
        ALLOW_DEMO_SEED: "true",
        DEMO_MODE: "true",
        ENABLE_DEMO_MODE: "true",
        DATABASE_URL: "postgresql://local:local@localhost/helios_demo",
      }),
    ).not.toThrow();
    expect(() =>
      assertDemoSeedAllowed({
        NODE_ENV: "development",
        ALLOW_DEMO_SEED: "true",
        DEMO_MODE: "true",
        ENABLE_DEMO_MODE: "true",
        DATABASE_URL: "postgresql://local:local@remote.example/helios_demo",
      }),
    ).toThrow("local PostgreSQL");
  });

  it("contains 12 deterministic synthetic patients and required showcase fixtures", async () => {
    const seed = await readFile(
      new URL("../prisma/seed.ts", import.meta.url),
      "utf8",
    );
    expect(seed.match(/DEMO-[A-Z]+-\d{3}/g)?.length).toBeGreaterThanOrEqual(12);
    expect(seed).toContain("demo-patient-aarav");
    expect(seed).toContain("demo-interview-aarav-current");
    expect(seed).toContain("demo-voice-aarav-hinglish");
    expect(seed).toContain("demo-document-aarav-allergy");
    expect(seed).toContain("Phase 5 SafetyEngine is absent");
    expect(seed).toContain("demo-verification-aarav");
    expect(seed).toContain("PRIORITY_REVIEW");
  });

  it("uses stable explicit demo identifiers rather than randomness", async () => {
    const seed = await readFile(
      new URL("../prisma/seed.ts", import.meta.url),
      "utf8",
    );
    expect(seed).not.toMatch(/randomUUID|Math\.random/);
    expect(seed).toContain('new Date("2026-09-13T');
  });
});
