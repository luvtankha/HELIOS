import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { errorHandler } from "../../src/middleware/error-handler.js";
import { requestContext } from "../../src/middleware/request-context.js";
import type { QueueOperations } from "../../src/queue/queue-service.js";
import { createQueueRouter } from "../../src/routes/queue.js";

function harness() {
  const service = {
    checkIn: vi.fn(async () => ({ tokenNumber: "A-001" })),
    patientStatus: vi.fn(async () => ({ tokenNumber: "A-001" })),
    doctorQueue: vi.fn(async () => ({ entries: [] })),
    callNext: vi.fn(async () => ({ id: "token-1" })),
    act: vi.fn(async () => ({ id: "token-1" })),
    setPaused: vi.fn(async (paused: boolean) => ({ paused })),
  };
  const app = express();
  app.use(
    requestContext,
    express.json(),
    createQueueRouter(service as unknown as QueueOperations),
    errorHandler,
  );
  return { app, service };
}

describe("queue routes", () => {
  it("uses only the signed patient session header for own-token status", async () => {
    const { app, service } = harness();
    await request(app)
      .get("/patient/me/queue-status?patientId=forged")
      .set("x-session-token", "patient-signed")
      .expect(200);
    expect(service.patientStatus).toHaveBeenCalledWith("patient-signed");
  });

  it("passes doctor credentials and a server request id to queue actions", async () => {
    const { app, service } = harness();
    await request(app)
      .post("/doctor/tokens/token-1/start")
      .set("x-doctor-token", "doctor-signed")
      .send({ role: "ADMIN", patientId: "forged" })
      .expect(200);
    expect(service.act).toHaveBeenCalledWith(
      "token-1",
      "start",
      "doctor-signed",
      expect.any(String),
    );
  });

  it("rejects unknown transition actions before service execution", async () => {
    const { app, service } = harness();
    await request(app)
      .post("/doctor/tokens/token-1/delete")
      .set("x-doctor-token", "doctor-signed")
      .expect(400);
    expect(service.act).not.toHaveBeenCalled();
  });
});
