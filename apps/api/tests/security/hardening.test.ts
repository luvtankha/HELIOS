import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { SignedTokenCodec } from "../../src/security/signed-token.js";
import { SessionProofService } from "../../src/security/session-proof.js";
import { DoctorProofService } from "../../src/security/doctor-proof.js";
import { resetRateLimitsForTests } from "../../src/middleware/rate-limit.js";
import type { DatabaseService } from "../../src/repositories/database.js";
import type { PatientFlowOperations } from "../../src/services/patient-flow-service.js";
import { PatientFlowService } from "../../src/services/patient-flow-service.js";
import type { PatientRepository } from "../../src/repositories/patient-repository.js";
import type { SessionRepository } from "../../src/repositories/session-repository.js";
import type { VisitRepository } from "../../src/repositories/visit-repository.js";
import type { ConsentRepository } from "../../src/repositories/consent-repository.js";
import type { IntakeRepository } from "../../src/repositories/intake-repository.js";
import { ComparisonService } from "../../src/comparison/comparison-service.js";
import type { ComparisonRepository } from "../../src/repositories/comparison-repository.js";
import { env, parseEnvironment } from "../../src/config/env.js";

const database: DatabaseService = {
  checkConnection: async () => "up",
  disconnect: async () => undefined,
};
const operations = {
  listPatients: vi.fn(async () => []),
  getPatient: vi.fn(async () => ({})),
  createSession: vi.fn(async () => ({ id: "session-1" })),
  getSession: vi.fn(async () => ({})),
  updateProgress: vi.fn(async () => ({})),
  recordConsent: vi.fn(async () => ({
    id: "consent-1",
    accepted: true,
    acceptedAt: "2026-01-01T00:00:00.000Z",
  })),
  createPatient: vi.fn(async () => ({ patient: {}, visitId: "visit-1" })),
  createVisit: vi.fn(async () => ({})),
  getVisit: vi.fn(async () => ({})),
  saveComplaint: vi.fn(async () => ({})),
  submitSession: vi.fn(async () => ({})),
} as unknown as PatientFlowOperations;

describe("security hardening boundaries", () => {
  beforeEach(() => {
    resetRateLimitsForTests();
    vi.clearAllMocks();
  });

  it("expires both roles and prevents patient tokens being used as doctor tokens", () => {
    let now = 1_700_000_000_000;
    const patient = new SessionProofService(
      "test-secret-long-enough",
      2,
      () => now,
    );
    const doctor = new DoctorProofService(
      "test-secret-long-enough",
      2,
      () => now,
    );
    const patientToken = patient.create("patient-session-1");
    const doctorToken = doctor.create("doctor-1");
    expect(patient.verify(patientToken)).toBe("patient-session-1");
    expect(doctor.verify(doctorToken)).toBe("doctor-1");
    expect(() => doctor.verify(patientToken)).toThrow();
    expect(() => patient.verify(doctorToken)).toThrow();
    now += 3_000;
    expect(() => patient.verify(patientToken)).toThrow();
    expect(() => doctor.verify(doctorToken)).toThrow();
  });

  it("rejects malformed or extended signatures", () => {
    const codec = new SignedTokenCodec(
      "test-secret-long-enough",
      "patient-session",
      60,
    );
    const valid = codec.create("session-1");
    expect(codec.verify(valid)?.subject).toBe("session-1");
    expect(codec.verify(`${valid}zz`)).toBeUndefined();
    expect(codec.verify(`${valid}.extra`)).toBeUndefined();
    expect(
      codec.verify(`${valid.slice(0, -1)}${valid.endsWith("0") ? "1" : "0"}`),
    ).toBeUndefined();
  });

  it("rejects unexpected mutation origins before invoking service logic", async () => {
    const response = await request(createApp(database, operations))
      .post("/api/v1/patient-sessions")
      .set("Origin", "https://evil.example")
      .send({ language: "en" });
    expect(response.status).toBe(403);
    expect(operations.createSession).not.toHaveBeenCalled();
  });

  it("limits repeated patient writes and does not return request secrets", async () => {
    const app = createApp(database, operations);
    let response;
    for (let index = 0; index < 11; index += 1) {
      response = await request(app)
        .post("/api/v1/patient-sessions")
        .set("x-session-token", "test-secret-that-must-not-echo")
        .send({ language: "en" });
    }
    expect(response?.status).toBe(429);
    expect(response?.headers["retry-after"]).toBeDefined();
    expect(JSON.stringify(response?.body)).not.toContain(
      "test-secret-that-must-not-echo",
    );
  });

  it("rejects cross-patient and cross-visit identifiers before querying the resource", async () => {
    const proof = new SessionProofService("test-secret-long-enough");
    const token = proof.create("session-a");
    const patients = { findById: vi.fn() };
    const sessions = {
      findById: vi.fn(async () => ({
        id: "session-a",
        patientId: "patient-a",
        visitId: "visit-a",
      })),
    };
    const visits = { findById: vi.fn(), create: vi.fn() };
    const service = new PatientFlowService(
      patients as unknown as PatientRepository,
      sessions as unknown as SessionRepository,
      visits as unknown as VisitRepository,
      {} as ConsentRepository,
      {} as IntakeRepository,
      proof,
    );
    await expect(service.getPatient("patient-b", token)).rejects.toMatchObject({
      code: "PATIENT_SESSION_FORBIDDEN",
    });
    await expect(service.getVisit("visit-b", token)).rejects.toMatchObject({
      code: "PATIENT_SESSION_FORBIDDEN",
    });
    await expect(
      service.createVisit(
        {
          patientId: "patient-b",
          visitType: "FOLLOW_UP",
          sessionId: "session-a",
        },
        token,
      ),
    ).rejects.toMatchObject({ code: "PATIENT_SESSION_FORBIDDEN" });
    await expect(
      service.createVisit(
        {
          patientId: "patient-a",
          visitType: "FOLLOW_UP",
          sessionId: "session-a",
        },
        token,
      ),
    ).rejects.toMatchObject({ code: "VISIT_EXISTS" });
    expect(patients.findById).not.toHaveBeenCalled();
    expect(visits.findById).not.toHaveBeenCalled();
    expect(visits.create).not.toHaveBeenCalled();
  });

  it("requires recorded consent before patient creation and reserves completion for the server", async () => {
    const proof = new SessionProofService("test-secret-long-enough");
    const token = proof.create("session-a");
    const sessions = {
      findById: vi.fn(async () => ({
        id: "session-a",
        patientId: null,
        visitId: null,
        patient: null,
        visit: null,
        status: "IN_PROGRESS",
        currentStep: "BASIC_INFO",
        language: "en",
        lastActiveAt: new Date(),
        draftData: null,
      })),
      updateProgress: vi.fn(),
    };
    const consents = {
      hasActivePreConsultationConsent: vi.fn(async () => false),
    };
    const intake = { createPatientVisit: vi.fn() };
    const service = new PatientFlowService(
      {} as PatientRepository,
      sessions as unknown as SessionRepository,
      {} as VisitRepository,
      consents as unknown as ConsentRepository,
      intake as unknown as IntakeRepository,
      proof,
    );
    await expect(
      service.createPatient(
        {
          sessionId: "session-a",
          fullName: "Synthetic Patient",
          age: 25,
          sex: "OTHER",
          preferredLanguage: "en",
        },
        token,
      ),
    ).rejects.toMatchObject({ code: "CONSENT_REQUIRED" });
    await expect(
      service.updateProgress("session-a", { currentStep: "COMPLETE" }, token),
    ).rejects.toMatchObject({ code: "SESSION_TRANSITION_INVALID" });
    expect(intake.createPatientVisit).not.toHaveBeenCalled();
    expect(sessions.updateProgress).not.toHaveBeenCalled();
  });

  it("does not issue an admin proof through the shared demo doctor code", async () => {
    const repository = {
      doctorByUsername: vi.fn(async () => ({
        id: "admin-1",
        displayName: "Demo Admin",
        role: "ADMIN",
      })),
    };
    const service = new ComparisonService(
      repository as unknown as ComparisonRepository,
    );
    await expect(
      service.signIn("demo-admin", env.DOCTOR_DEMO_ACCESS_CODE),
    ).rejects.toMatchObject({ code: "DOCTOR_SIGN_IN_FAILED" });
  });

  it("does not allow demo dashboard fallback in production configuration", () => {
    expect(() =>
      parseEnvironment({
        NODE_ENV: "production",
        ENABLE_DEMO_MODE: "false",
        DEMO_MODE: "true",
        SESSION_TOKEN_SECRET: "a-unique-production-test-secret",
        DOCTOR_DEMO_ACCESS_CODE: "a-unique-doctor-test-code",
      }),
    ).toThrow("DEMO_MODE");
  });
});
