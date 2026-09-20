import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type { DatabaseService } from "../src/repositories/database.js";

function mockDatabase(
  status: "up" | "down" | "not_configured",
): DatabaseService {
  return {
    checkConnection: async () => status,
    disconnect: async () => undefined,
  };
}

describe("health endpoints", () => {
  it.each(["/health", "/api/v1/health"])(
    "returns the standard response at %s",
    async (path) => {
      const response = await request(createApp(mockDatabase("up"))).get(path);
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: { status: "ok", api: "up", database: "up" },
      });
      expect(response.headers["x-request-id"]).toMatch(/^req_/);
    },
  );

  it("reports a degraded database without crashing", async () => {
    const response = await request(createApp(mockDatabase("down"))).get(
      "/health",
    );
    expect(response.status).toBe(503);
    expect(response.body.data.status).toBe("degraded");
  });
});
