import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { errorHandler } from "../src/middleware/error-handler.js";
import { requestContext } from "../src/middleware/request-context.js";
import { createSpecializationRoutingRouter } from "../src/routes/specialization-routing.js";

function harness() {
  const service = {
    assess: vi.fn(async () => ({ decisionId: "routing-1" })),
    providers: vi.fn(async () => ({ providers: [] })),
    select: vi.fn(async () => ({ selectedProviderId: null })),
    audit: vi.fn(async () => []),
  };
  const app = express();
  app.use(
    requestContext,
    express.json(),
    createSpecializationRoutingRouter(service),
    errorHandler,
  );
  return { app, service };
}
describe("specialization routing API", () => {
  it("uses only the signed patient proof for assessment", async () => {
    const { app, service } = harness();
    await request(app)
      .post("/patient/me/routing")
      .set("x-session-token", "patient-proof")
      .send({})
      .expect(200);
    expect(service.assess).toHaveBeenCalledWith("patient-proof");
  });
  it("validates the directory filter and retains ownership proof", async () => {
    const { app, service } = harness();
    await request(app)
      .get("/patient/me/providers?specialization=neurology")
      .set("x-session-token", "patient-proof")
      .expect(200);
    expect(service.providers).toHaveBeenCalledWith("patient-proof", "neurology");
    await request(app)
      .get("/patient/me/providers?specialization=neurology&patientId=forged")
      .set("x-session-token", "patient-proof")
      .expect(400);
  });
  it("rejects arbitrary selection bodies", async () => {
    const { app, service } = harness();
    await request(app)
      .post("/patient/me/routing/provider")
      .set("x-session-token", "patient-proof")
      .send({ providerId: "doctor-1", role: "ADMIN" })
      .expect(400);
    expect(service.select).not.toHaveBeenCalled();
  });
  it("requires doctor proof for audit retrieval", async () => {
    const { app, service } = harness();
    await request(app)
      .get("/doctor/visits/visit-1/routing")
      .set("x-doctor-token", "doctor-proof")
      .expect(200);
    expect(service.audit).toHaveBeenCalledWith("visit-1", "doctor-proof");
  });
});
