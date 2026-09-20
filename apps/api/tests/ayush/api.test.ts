import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { AyushOperations } from "../../src/ayush/ayush-service.js";
import { errorHandler } from "../../src/middleware/error-handler.js";
import { requestContext } from "../../src/middleware/request-context.js";
import { createAyushRouter } from "../../src/routes/ayush.js";

describe("AYUSH API", () => {
  it("keeps patient and doctor authorization headers separate", async () => {
    const service = operations();
    const instance = app(service);
    expect(
      (
        await request(instance)
          .get("/api/v1/patients/patient-1/ayush")
          .set("x-session-token", "patient-token")
      ).status,
    ).toBe(200);
    expect(
      (
        await request(instance)
          .get("/api/v1/doctor/patients/patient-1/ayush")
          .set("x-doctor-token", "doctor-token")
      ).status,
    ).toBe(200);
    expect(service.patientView).toHaveBeenCalledWith(
      "patient-1",
      "patient-token",
    );
    expect(service.doctorView).toHaveBeenCalledWith(
      "patient-1",
      "doctor-token",
    );
  });

  it("accepts explicit unknown medicine data without inventing a value", async () => {
    const service = operations();
    const response = await request(app(service))
      .post("/api/v1/patients/patient-1/ayush")
      .set("x-session-token", "patient-token")
      .send({
        system: "AYURVEDA",
        useStatus: "CURRENT",
        originalName: "NOT_SPECIFIED",
      });
    expect(response.status).toBe(201);
    expect(service.report).toHaveBeenCalledWith(
      "patient-1",
      expect.objectContaining({ originalName: "NOT_SPECIFIED" }),
      "patient-token",
      expect.any(String),
    );
  });

  it("rejects arbitrary systems and forged doctor fields", async () => {
    const service = operations();
    const response = await request(app(service))
      .post("/api/v1/doctor/patients/patient-1/ayush")
      .send({
        system: "INVENTED",
        useStatus: "CURRENT",
        originalName: "Name",
        doctorId: "forged",
      });
    expect(response.status).toBe(400);
    expect(service.enter).not.toHaveBeenCalled();
  });

  it("protects the record evidence detail route with the doctor token", async () => {
    const service = operations();
    const response = await request(app(service))
      .get("/api/v1/doctor/ayush/record-1")
      .set("x-doctor-token", "doctor-token");
    expect(response.status).toBe(200);
    expect(service.detail).toHaveBeenCalledWith("record-1", "doctor-token");
  });
});

function operations(): AyushOperations {
  const view = {
    patient: { id: "patient-1", fullName: "Aarav Sharma", patientCode: "A1" },
    records: [],
    conventionalMedications: [],
    existingSafetySignals: [],
    concurrentUseIdentified: false,
    interactionInformation: "UNAVAILABLE" as const,
  };
  const record = {
    id: "record-1",
    patientId: "patient-1",
    system: "AYURVEDA" as const,
    useStatus: "CURRENT" as const,
    originalName: "NOT_SPECIFIED",
    sourceType: "PATIENT_REPORTED" as const,
    verificationStatus: "NEEDS_REVIEW" as const,
    verificationVersion: 0,
    evidence: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return {
    patientView: vi.fn(async () => view),
    doctorView: vi.fn(async () => view),
    detail: vi.fn(async () => record),
    report: vi.fn(async () => record),
    enter: vi.fn(async () => record),
    projectDocument: vi.fn(async () => undefined),
    removeDocument: vi.fn(async () => undefined),
  };
}

function app(service: AyushOperations) {
  const value = express();
  value.use(express.json());
  value.use(requestContext);
  value.use("/api/v1", createAyushRouter(service));
  value.use(errorHandler);
  return value;
}
