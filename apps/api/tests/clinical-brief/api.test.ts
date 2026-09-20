import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { ClinicalBriefOperations } from "../../src/clinical-brief/clinical-brief-service.js";
import { errorHandler } from "../../src/middleware/error-handler.js";
import { requestContext } from "../../src/middleware/request-context.js";
import { createClinicalBriefRouter } from "../../src/routes/clinical-briefs.js";

const brief = {
  id: "brief-1",
  patientId: "patient-1",
  patientName: "Synthetic Patient",
  patientCode: "SYNTHETIC",
  age: 24,
  sex: "MALE" as const,
  preferredLanguage: "en",
  visitId: "visit-1",
  visitDate: "2026-09-09T00:00:00Z",
  status: "GENERATED" as const,
  version: 1,
  generatorVersion: "phase9-v1",
  generatedAt: "2026-09-09T00:00:00Z",
  narrative: "Synthetic complaint.",
  sections: [],
  claimCount: 0,
};
function operations(): ClinicalBriefOperations {
  return {
    generate: vi.fn(async () => brief),
    quick: vi.fn(async () => brief),
    detail: vi.fn(async () => brief),
    list: vi.fn(async () => []),
    refresh: vi.fn(async () => brief),
    evidence: vi.fn(async () => []),
    claim: vi.fn(async () => ({
      id: "claim",
      claimKey: "claim",
      sectionType: "TODAYS_REASON",
      text: "Synthetic",
      sourceType: "INTERVIEW",
      sourceId: "source",
      verificationStatus: "CAPTURED",
      confidenceBand: "UNKNOWN",
      needsVerification: false,
      evidence: [],
      patientId: "patient-1",
      visitId: "visit-1",
    })),
    review: vi.fn(async () => ({ ...brief, status: "REVIEWED" })),
    archive: vi.fn(async () => ({ ...brief, status: "ARCHIVED" })),
  };
}
function app(service: ClinicalBriefOperations) {
  const value = express();
  value.use(express.json());
  value.use(requestContext);
  value.use("/api/v1", createClinicalBriefRouter(service));
  value.use(errorHandler);
  return value;
}

describe("clinical brief API", () => {
  it("creates a visit-bound brief and forwards doctor authorization", async () => {
    const service = operations();
    const response = await request(app(service))
      .post("/api/v1/patients/patient-1/briefs")
      .set("x-doctor-token", "signed")
      .send({ visitId: "visit-1" });
    expect(response.status).toBe(201);
    expect(service.generate).toHaveBeenCalledWith(
      "patient-1",
      "visit-1",
      "signed",
      expect.any(String),
    );
  });
  it("rejects malformed visit IDs before generation", async () => {
    const service = operations();
    const response = await request(app(service))
      .post("/api/v1/patients/patient-1/briefennials")
      .send({ visitId: "" });
    expect(response.status).toBe(404);
    const validRoute = await request(app(service))
      .post("/api/v1/patients/patient-1/briefs")
      .send({ visitId: "" });
    expect(validRoute.status).toBe(400);
    expect(service.generate).not.toHaveBeenCalled();
  });
  it("supports quick, refresh, evidence, review, archive, and claim routes", async () => {
    const service = operations();
    const instance = app(service);
    expect(
      (
        await request(instance).get(
          "/api/v1/patients/patient-1/clinical-brief?visitId=visit-1",
        )
      ).status,
    ).toBe(200);
    expect(
      (await request(instance).post("/api/v1/briefs/brief-1/refresh")).status,
    ).toBe(200);
    expect(
      (await request(instance).get("/api/v1/briefs/brief-1/evidence")).status,
    ).toBe(200);
    expect(
      (await request(instance).get("/api/v1/briefs/brief-1/claims/claim-1"))
        .status,
    ).toBe(200);
    expect(
      (await request(instance).post("/api/v1/briefs/brief-1/review")).status,
    ).toBe(200);
    expect(
      (await request(instance).post("/api/v1/briefs/brief-1/archive")).status,
    ).toBe(200);
  });
});
