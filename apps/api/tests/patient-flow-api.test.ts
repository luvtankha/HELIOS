import type { PatientFlowOperations } from "../src/services/patient-flow-service.js";
import type { PatientSessionDto } from "@helios/shared";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import type { DatabaseService } from "../src/repositories/database.js";

const sessionId = "cm123456789012345678901234";
const patientId = "cm223456789012345678901234";
const visitId = "cm323456789012345678901234";

const session: PatientSessionDto = {
  id: sessionId,
  status: "IN_PROGRESS",
  currentStep: "LANGUAGE",
  language: "en",
  lastActiveAt: new Date(0).toISOString(),
};

const database: DatabaseService = {
  checkConnection: async () => "up",
  disconnect: async () => undefined,
};

const service = {
  listPatients: vi.fn(async () => []),
  getPatient: vi.fn(async () => ({})),
  createSession: vi.fn(async () => session),
  getSession: vi.fn(async () => session),
  updateProgress: vi.fn(async () => ({
    ...session,
    currentStep: "CONSENT" as const,
  })),
  recordConsent: vi.fn(async () => ({
    id: "consent-1",
    accepted: true,
    acceptedAt: new Date(0).toISOString(),
  })),
  createPatient: vi.fn(async () => ({ patient: { id: patientId }, visitId })),
  createVisit: vi.fn(async () => ({ id: visitId })),
  getVisit: vi.fn(async () => ({ id: visitId })),
  saveComplaint: vi.fn(async () => ({ id: visitId })),
  submitSession: vi.fn(async () => ({
    ...session,
    currentStep: "COMPLETE" as const,
  })),
} satisfies PatientFlowOperations;

describe("patient flow API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a patient session", async () => {
    const response = await request(createApp(database, service))
      .post("/api/v1/patient-sessions")
      .send({ language: "hi" });
    expect(response.status).toBe(201);
    expect(response.body.data.id).toBe(sessionId);
    expect(service.createSession).toHaveBeenCalledWith("hi");
  });

  it("requires explicit consent", async () => {
    const response = await request(createApp(database, service))
      .post("/api/v1/consents")
      .send({
        sessionId,
        consentType: "PRE_CONSULTATION",
        accepted: false,
        version: "1.0",
      });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(service.recordConsent).not.toHaveBeenCalled();
  });

  it("persists valid consent", async () => {
    const response = await request(createApp(database, service))
      .post("/api/v1/consents")
      .send({
        sessionId,
        consentType: "PRE_CONSULTATION",
        accepted: true,
        version: "1.0",
      });
    expect(response.status).toBe(201);
    expect(service.recordConsent).toHaveBeenCalledOnce();
  });

  it("creates patient details and a visit", async () => {
    const response = await request(createApp(database, service))
      .post("/api/v1/patients")
      .send({
        sessionId,
        fullName: "Aarav Sharma",
        age: 24,
        sex: "MALE",
        preferredLanguage: "en",
      });
    expect(response.status).toBe(201);
    expect(response.body.data.visitId).toBe(visitId);
  });

  it("saves the patient-reported complaint", async () => {
    const response = await request(createApp(database, service))
      .patch(`/api/v1/visits/${visitId}/complaint`)
      .send({
        chiefComplaint: "I have had stomach pain for three days.",
        healthDetails: { location: "Upper abdomen" },
      });
    expect(response.status).toBe(200);
    expect(service.saveComplaint).toHaveBeenCalledWith(
      visitId,
      expect.any(String),
      { location: "Upper abdomen" },
      undefined,
    );
  });

  it("submits the persisted session", async () => {
    const response = await request(createApp(database, service))
      .post(`/api/v1/patient-sessions/${sessionId}/submit`)
      .set("x-session-token", "test-session-proof");
    expect(response.status).toBe(200);
    expect(service.submitSession).toHaveBeenCalledWith(
      sessionId,
      "test-session-proof",
    );
  });
});
