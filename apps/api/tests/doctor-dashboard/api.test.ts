import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { DoctorDashboardOperations } from "../../src/doctor-dashboard/doctor-dashboard-service.js";
import { errorHandler } from "../../src/middleware/error-handler.js";
import { requestContext } from "../../src/middleware/request-context.js";
import { createDoctorDashboardRouter } from "../../src/routes/doctor-dashboard.js";

function harness() {
  const service = {
    dashboard: vi.fn(async () => ({ queue: [] })),
    workspace: vi.fn(async () => ({ patient: {} })),
    notes: vi.fn(async () => []),
    createNote: vi.fn(async () => ({ id: "note-1" })),
    updateNote: vi.fn(async () => ({ id: "note-1" })),
    transitionVisit: vi.fn(async () => ({
      visitId: "visit-1",
      status: "IN_PROGRESS",
    })),
  };
  const app = express();
  app.use(
    requestContext,
    express.json(),
    createDoctorDashboardRouter(
      service as unknown as DoctorDashboardOperations,
    ),
    errorHandler,
  );
  return { app, service };
}

describe("doctor dashboard routes", () => {
  it("passes only validated queue filters and the signed token", async () => {
    const { app, service } = harness();
    await request(app)
      .get(
        "/doctor/dashboard?search=Aarav&sort=priority&limit=10&doctorId=forged",
      )
      .set("x-doctor-token", "signed")
      .expect(200);
    expect(service.dashboard).toHaveBeenCalledWith(
      {
        search: "Aarav",
        sort: "priority",
        direction: "asc",
        page: 1,
        limit: 10,
      },
      "signed",
    );
  });

  it("rejects invalid status transitions before service execution", async () => {
    const { app, service } = harness();
    await request(app)
      .post("/doctor/visits/visit-1/status")
      .set("x-doctor-token", "signed")
      .send({ status: "CANCELLED", role: "ADMIN" })
      .expect(400);
    expect(service.transitionVisit).not.toHaveBeenCalled();
  });

  it("scopes note mutations with both patient and note identifiers", async () => {
    const { app, service } = harness();
    await request(app)
      .patch("/doctor/patients/patient-1/notes/note-1")
      .set("x-doctor-token", "signed")
      .send({ content: "Reviewed synthetic note" })
      .expect(200);
    expect(service.updateNote).toHaveBeenCalledWith(
      "patient-1",
      "note-1",
      "Reviewed synthetic note",
      "signed",
      expect.any(String),
    );
  });
});
