import { describe, expect, it } from "vitest";
import { parseEnvironment } from "../src/config/env.js";

describe("environment validation", () => {
  it("applies safe development defaults", () => {
    const parsed = parseEnvironment({});
    expect(parsed.PORT).toBe(5000);
    expect(parsed.ENABLE_VOICE).toBe(false);
    expect(parsed.DEMO_MODE).toBe(true);
    expect(parsed.SPEECH_PROVIDER).toBe("mock");
    expect(parsed.VOICE_MAX_DURATION_SECONDS).toBe(75);
  });

  it("rejects an invalid port", () => {
    expect(() => parseEnvironment({ PORT: "70000" })).toThrow(
      "Invalid environment configuration",
    );
  });

  it("requires a non-default session secret in production", () => {
    expect(() => parseEnvironment({ NODE_ENV: "production" })).toThrow(
      "SESSION_TOKEN_SECRET",
    );
  });
});
