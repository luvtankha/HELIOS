import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { ComparisonOperations } from "../../src/comparison/comparison-service.js";
import { errorHandler } from "../../src/middleware/error-handler.js";
import { requestContext } from "../../src/middleware/request-context.js";
import { createComparisonRouter } from "../../src/routes/comparisons.js";

const comparison = {
  id: "comparison-1",
  patientId: "patient-1",
  patientName: "Synthetic Patient",
  previousVisitId: "visit-1",
  currentVisitId: "visit-2",
  previousVisitDate: "2026-05-01T00:00:00.000Z",
  currentVisitDate: "2026-09-01T00:00:00.000Z",
  previousSnapshotId: "snapshot-1",
  currentSnapshotId: "snapshot-2",
  status: "GENERATED" as const,
  engineVersion: "phase8-v1",
  createdAt: "2026-09-09T00:00:00.000Z",
  summary: {
    newCount: 0,
    changedCount: 0,
    removedCount: 0,
    conflictCount: 0,
    unknownCount: 0,
    unchangedCount: 0,
    newlyCapturedCount: 0,
    notComparableCount: 0,
    needsReviewCount: 0,
  },
  changes: [],
};

function app(service: ComparisonOperations) {
  const value = express();
  value.use(express.json());
  value.use(requestContext);
  value.use("/api/v1", createComparisonRouter(service));
  value.use(errorHandler);
  return value;
}
function operations(): ComparisonOperations {
  return {
    signIn: vi.fn(async () => ({
      doctorId: "doctor-1",
      displayName: "Doctor",
      role: "DOCTOR",
      doctorToken: "signed",
    })),
    patients: vi.fn(async () => []),
    create: vi.fn(async () => comparison),
    quick: vi.fn(async () => comparison),
    detail: vi.fn(async () => comparison),
    list: vi.fn(async () => []),
    changes: vi.fn(async () => []),
    change: vi.fn(async () => {
      throw new Error("unused");
    }),
  };
}

describe("comparison API contract", () => {
  it("creates a comparison and forwards the doctor proof", async () => {
    const service = operations();
    const response = await request(app(service))
      .post("/api/v1/patients/patient-1/comparisons")
      .set("x-doctor-token", "signed")
      .send({ previousVisitId: "visit-1", currentVisitId: "visit-2" });
    expect(response.status).toBe(201);
    expect(response.body.data.id).toBe("comparison-1");
    expect(service.create).toHaveBeenCalledWith(
      "patient-1",
      "visit-1",
      "visit-2",
      "signed",
      expect.any(String),
    );
  });
  it("rejects malformed visit selection before service execution", async () => {
    const service = operations();
    const response = await request(app(service))
      .post("/api/v1/patients/patient-1/comparisons")
      .send({ previousVisitId: "" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(service.create).not.toHaveBeenCalled();
  });
  it("supports quick comparison and filtered change routes", async () => {
    const service = operations();
    expect(
      (
        await request(app(service))
          .post("/api/v1/patients/patient-1/comparisons/quick")
          .set("x-doctor-token", "signed")
      ).status,
    ).toBe(201);
    expect(
      (
        await request(app(service))
          .get(
            "/api/v1/comparisons/comparison-1/changes?changeType=CHANGED&needsReview=true",
          )
          .set("x-doctor-token", "signed")
      ).status,
    ).toBe(200);
    expect(service.changes).toHaveBeenCalledWith(
      "comparison-1",
      { changeType: "CHANGED", needsReview: true },
      "signed",
    );
  });
});
