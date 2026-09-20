import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { DemoResetService } from "../src/demo/demo-reset-service.js";
import { createDemoResetRouter } from "../src/routes/demo-reset.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import { DoctorProofService } from "../src/security/doctor-proof.js";

const demoEnv = {
  NODE_ENV: "development",
  ALLOW_DEMO_SEED: "true",
  DEMO_MODE: "true",
  ENABLE_DEMO_MODE: "true",
  DATABASE_URL: "postgresql://user:password@localhost:5432/helios_sih_demo",
};
const proof = new DoctorProofService("a-test-only-demo-session-secret");
const presenter = {
  id: "demo-user-doctor",
  username: "demo.doctor",
  role: "DOCTOR",
  status: "ACTIVE",
};
function fixture(environment: NodeJS.ProcessEnv, user: object | null = null) {
  const run = vi.fn(async () => {});
  const findUnique = vi.fn(async () => user);
  const query = vi.fn(async () => [{ database: "helios_sih_demo" }]);
  const auditCreate = vi.fn(async () => ({}));
  const prisma = {
    user: { findUnique },
    $queryRaw: query,
    auditLog: { create: auditCreate },
  } as unknown as PrismaClient;
  const app = express();
  app.use(express.json());
  app.use(
    "/api/v1",
    createDemoResetRouter(
      new DemoResetService(prisma, proof, run, environment),
    ),
  );
  app.use(errorHandler);
  return { app, run, findUnique, query, auditCreate };
}

describe("demo reset boundary", () => {
  it("blocks production POST before any database or destructive action", async () => {
    const { app, run, findUnique, query } = fixture({
      ...demoEnv,
      NODE_ENV: "production",
    });
    const response = await request(app)
      .post("/api/v1/demo/reset")
      .set("x-doctor-token", proof.create("demo-user-doctor"))
      .send({ confirmation: "RESET SIH DEMO" });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("DEMO_RESET_UNAVAILABLE");
    expect(run).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
  it("blocks development without explicit demo mode", async () => {
    const { app, run, findUnique } = fixture({
      ...demoEnv,
      DEMO_MODE: "false",
    });
    const response = await request(app)
      .post("/api/v1/demo/reset")
      .send({ confirmation: "RESET SIH DEMO" });
    expect(response.status).toBe(403);
    expect(run).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
  });
  it("blocks a non-demo database", async () => {
    const { app, run, findUnique } = fixture({
      ...demoEnv,
      DATABASE_URL:
        "postgresql://user:password@localhost:5432/helios_production",
    });
    const response = await request(app)
      .post("/api/v1/demo/reset")
      .send({ confirmation: "RESET SIH DEMO" });
    expect(response.status).toBe(403);
    expect(run).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
  });
  it("requires doctor authentication and the designated presenter identity", async () => {
    const { app, run } = fixture(demoEnv, {
      id: "other-doctor",
      username: "demo.doctor2",
      role: "DOCTOR",
      status: "ACTIVE",
    });
    const unauthenticated = await request(app)
      .post("/api/v1/demo/reset")
      .send({ confirmation: "RESET SIH DEMO" });
    expect(unauthenticated.status).toBe(401);
    const unauthorized = await request(app)
      .post("/api/v1/demo/reset")
      .set("x-doctor-token", proof.create("other-doctor"))
      .send({ confirmation: "RESET SIH DEMO" });
    expect(unauthorized.status).toBe(403);
    expect(run).not.toHaveBeenCalled();
  });
  it("rejects actual database identity mismatch before cleanup", async () => {
    const { app, run, query } = fixture(demoEnv, presenter);
    query.mockResolvedValueOnce([{ database: "helios_production" }]);
    const response = await request(app)
      .post("/api/v1/demo/reset")
      .set("x-doctor-token", proof.create(presenter.id))
      .send({ confirmation: "RESET SIH DEMO" });
    expect(response.status).toBe(403);
    expect(run).not.toHaveBeenCalled();
  });
  it("reports runner failure and records an audit failure", async () => {
    const { app, run, auditCreate } = fixture(demoEnv, presenter);
    run.mockRejectedValueOnce(new Error("simulated seed failure"));
    const response = await request(app)
      .post("/api/v1/demo/reset")
      .set("x-doctor-token", proof.create(presenter.id))
      .send({ confirmation: "RESET SIH DEMO" });
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("DEMO_RESET_FAILED");
    expect(auditCreate).toHaveBeenCalledOnce();
  });
  it("rejects a concurrent reset without running a second cleanup", async () => {
    const { app, run } = fixture(demoEnv, presenter);
    let release: (() => void) | undefined;
    run.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const first = request(app)
      .post("/api/v1/demo/reset")
      .set("x-doctor-token", proof.create(presenter.id))
      .send({ confirmation: "RESET SIH DEMO" })
      .then((response) => response);
    await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
    const second = await request(app)
      .post("/api/v1/demo/reset")
      .set("x-doctor-token", proof.create(presenter.id))
      .send({ confirmation: "RESET SIH DEMO" });
    expect(second.status).toBe(409);
    expect(run).toHaveBeenCalledOnce();
    release?.();
    expect((await first).status).toBe(503);
  });
});
