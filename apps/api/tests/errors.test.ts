import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

describe("API errors", () => {
  it("uses the standard error envelope", async () => {
    const response = await request(createApp()).get("/missing");
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "NOT_FOUND" },
    });
    expect(response.body.error.requestId).toMatch(/^req_/);
  });
});
