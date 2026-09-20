import { describe, expect, it, vi } from "vitest";
import { DoctorDashboardService } from "../../src/doctor-dashboard/doctor-dashboard-service.js";
import type { ClinicalBriefOperations } from "../../src/clinical-brief/clinical-brief-service.js";
import type { ComparisonOperations } from "../../src/comparison/comparison-service.js";
import type { DocumentRepository } from "../../src/repositories/document-repository.js";
import type {
  DoctorDashboardRepository,
  DoctorQueueVisit,
} from "../../src/repositories/doctor-dashboard-repository.js";
import type { TimelineRepository } from "../../src/repositories/timeline-repository.js";
import { DoctorProofService } from "../../src/security/doctor-proof.js";
import { SessionProofService } from "../../src/security/session-proof.js";
import type { VerificationOperations } from "../../src/verification/verification-service.js";

const proof = new DoctorProofService("phase-thirteen-test-secret-long-enough");
const token = proof.create("doctor-1");

function queueVisit(overrides: Record<string, unknown> = {}) {
  return {
    id: "visit-1",
    patientId: "patient-1",
    tokenNumber: "A-1",
    status: "READY_FOR_DOCTOR",
    visitType: "FOLLOW_UP",
    startedAt: new Date("2026-09-13T04:00:00Z"),
    completedAt: null,
    createdAt: new Date("2026-09-13T04:00:00Z"),
    updatedAt: new Date("2026-09-13T04:00:00Z"),
    patient: {
      id: "patient-1",
      patientCode: "SYNTHETIC-1",
      fullName: "Aarav Sharma",
      age: 24,
      sex: "MALE",
      phone: "0000000000",
      preferredLanguage: "hi",
    },
    clinicalHistory: {
      chiefComplaint: "Synthetic stomach pain",
      verificationStatus: "PATIENT_REPORTED",
    },
    symptoms: [{ name: "Pain", verificationStatus: "PATIENT_REPORTED" }],
    medications: [],
    allergies: [],
    observations: [],
    documentFacts: [],
    ayushRecords: [],
    documents: [],
    riskSignals: [
      {
        id: "risk-1",
        severity: "HIGH",
        title: "Review",
        createdAt: new Date(),
        status: "OPEN",
      },
    ],
    ...overrides,
  } as unknown as DoctorQueueVisit;
}

function harness(repositoryOverrides: Record<string, unknown> = {}) {
  const repository = {
    doctor: vi.fn(async () => ({
      id: "doctor-1",
      displayName: "Dr Meera",
      role: "DOCTOR",
      preferredLanguage: "en",
    })),
    assigned: vi.fn(async () => true),
    queueVisits: vi.fn(async () => [queueVisit()]),
    patient: vi.fn(async (id: string) =>
      id === "patient-1"
        ? {
            id,
            patientCode: "SYNTHETIC-1",
            fullName: "Aarav Sharma",
            age: 24,
            sex: "MALE",
            phone: null,
            preferredLanguage: "hi",
          }
        : null,
    ),
    visit: vi.fn(async (patientId: string) =>
      patientId === "patient-1" ? null : null,
    ),
    notes: vi.fn(async () => []),
    createNote: vi.fn(),
    updateNote: vi.fn(async () => null),
    visitStatus: vi.fn(async () => ({
      id: "visit-1",
      patientId: "patient-1",
      status: "WAITING",
    })),
    transitionVisit: vi.fn(async () => null),
    audit: vi.fn(async () => ({})),
    ...repositoryOverrides,
  };
  const service = new DoctorDashboardService(
    repository as unknown as DoctorDashboardRepository,
    { quick: vi.fn() } as unknown as ClinicalBriefOperations,
    { quick: vi.fn() } as unknown as ComparisonOperations,
    { history: vi.fn(async () => []) } as unknown as VerificationOperations,
    { listForDoctor: vi.fn(async () => []) } as unknown as DocumentRepository,
    { listForDoctor: vi.fn(async () => []) } as unknown as TimelineRepository,
    proof,
  );
  return { repository, service };
}

describe("DoctorDashboardService", () => {
  it("rejects missing, patient, and tampered tokens before reading clinical data", async () => {
    const { repository, service } = harness();
    await expect(
      service.dashboard({ sort: "time", direction: "asc", page: 1, limit: 20 }),
    ).rejects.toMatchObject({ code: "DOCTOR_TOKEN_REQUIRED" });
    await expect(
      service.dashboard(
        { sort: "time", direction: "asc", page: 1, limit: 20 },
        "patient-1.invalid",
      ),
    ).rejects.toMatchObject({ code: "DOCTOR_TOKEN_INVALID" });
    const patientToken = new SessionProofService(
      "phase-thirteen-test-secret-long-enough",
    ).create("patient-session-1");
    await expect(
      service.dashboard(
        { sort: "time", direction: "asc", page: 1, limit: 20 },
        patientToken,
      ),
    ).rejects.toMatchObject({ code: "DOCTOR_TOKEN_INVALID" });
    expect(repository.queueVisits).not.toHaveBeenCalled();
  });

  it("builds priority, verification metrics, notifications and server-side search", async () => {
    const { service } = harness();
    const result = await service.dashboard(
      {
        search: "aarav",
        sort: "priority",
        direction: "asc",
        page: 1,
        limit: 20,
      },
      token,
    );
    expect(result.queue[0]).toMatchObject({
      patientCode: "SYNTHETIC-1",
      status: "HIGH_PRIORITY_REVIEW",
      priority: "HIGH",
      pendingVerificationCount: 2,
    });
    expect(result.metrics).toMatchObject({
      patientsToday: 1,
      pendingVerification: 2,
      highPriority: 1,
    });
    expect(
      result.notifications.some((item) => item.kind === "SAFETY_ATTENTION"),
    ).toBe(true);
    const symptom = await service.dashboard(
      { search: "pain", sort: "time", direction: "asc", page: 1, limit: 20 },
      token,
    );
    expect(symptom.queue).toHaveLength(1);
    const empty = await service.dashboard(
      {
        search: "another patient",
        sort: "time",
        direction: "asc",
        page: 1,
        limit: 20,
      },
      token,
    );
    expect(empty.queue).toEqual([]);
  });

  it("blocks cross-patient workspace access", async () => {
    const { service } = harness();
    await expect(
      service.workspace("another-patient", undefined, token),
    ).rejects.toMatchObject({ code: "PATIENT_NOT_FOUND" });
  });

  it("denies an active doctor who is not assigned to the patient", async () => {
    const { service, repository } = harness({
      assigned: vi.fn(async () => false),
    });
    await expect(
      service.workspace("patient-1", undefined, token),
    ).rejects.toMatchObject({ code: "DOCTOR_PATIENT_FORBIDDEN" });
    await expect(
      service.createNote("patient-1", { content: "No access" }, token),
    ).rejects.toMatchObject({ code: "DOCTOR_PATIENT_FORBIDDEN" });
    expect(repository.visit).not.toHaveBeenCalled();
  });

  it("enforces the consultation state machine", async () => {
    const { service } = harness();
    await expect(
      service.transitionVisit("visit-1", "VERIFIED", token),
    ).rejects.toMatchObject({ code: "VISIT_TRANSITION_INVALID" });
  });

  it("does not let one doctor edit another doctor's note", async () => {
    const { service } = harness();
    await expect(
      service.updateNote("patient-1", "note-2", "changed", token),
    ).rejects.toMatchObject({ code: "DOCTOR_NOTE_FORBIDDEN" });
  });
});
