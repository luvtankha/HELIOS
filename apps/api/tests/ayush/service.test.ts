import { describe, expect, it, vi } from "vitest";
import { AyushService } from "../../src/ayush/ayush-service.js";
import { AppError } from "../../src/utils/app-error.js";

describe("AyushService security and safety boundaries", () => {
  it("blocks patient A from patient B records", async () => {
    const repository = baseRepository();
    repository.sessionOwns.mockResolvedValue(null);
    const service = create(repository);
    await expect(
      service.patientView("patient-b", "patient-a-token"),
    ).rejects.toMatchObject({
      code: "AYUSH_PATIENT_FORBIDDEN",
      statusCode: 403,
    });
  });

  it("requires an active doctor for the doctor view", async () => {
    const repository = baseRepository();
    repository.activeDoctor.mockResolvedValue(null);
    const service = create(repository);
    await expect(
      service.doctorView("patient-1", "token"),
    ).rejects.toMatchObject({
      code: "DOCTOR_NOT_AUTHORIZED",
      statusCode: 403,
    });
  });

  it("does not expose client control over doctor identity", async () => {
    const repository = baseRepository();
    repository.create.mockResolvedValue(record());
    const service = create(repository);
    await service.enter(
      "patient-1",
      {
        system: "AYURVEDA",
        useStatus: "CURRENT",
        originalName: "Documented name",
      },
      "token",
    );
    expect(repository.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ actorUserId: "authenticated-doctor" }),
    );
  });

  it("shows unavailable interaction information and creates no RiskSignal", async () => {
    const repository = baseRepository();
    repository.patientView.mockResolvedValue({
      id: "patient-1",
      fullName: "Aarav Sharma",
      patientCode: "A1",
      ayushRecords: [],
      medications: [
        {
          id: "med-1",
          name: "Metformin",
          dose: "500 mg",
          frequency: "twice daily",
          verificationStatus: "DOCTOR_VERIFIED",
        },
      ],
      visits: [{ riskSignals: [] }],
    });
    const service = create(repository);
    const view = await service.doctorView("patient-1", "token");
    expect(view.interactionInformation).toBe("UNAVAILABLE");
    expect(view.existingSafetySignals).toEqual([]);
    expect(Object.keys(repository)).not.toContain("riskSignal");
  });

  it("rejects an invalid signed doctor token before repository access", async () => {
    const repository = baseRepository();
    const service = new AyushService(
      repository as never,
      { rebuild: vi.fn() } as never,
      { verify: () => "session" } as never,
      {
        verify: () => {
          throw new AppError("invalid", 403, "DOCTOR_TOKEN_INVALID");
        },
      } as never,
    );
    await expect(service.doctorView("patient-1", "bad")).rejects.toMatchObject({
      code: "DOCTOR_TOKEN_INVALID",
    });
    expect(repository.activeDoctor).not.toHaveBeenCalled();
  });
});

function create(repository: ReturnType<typeof baseRepository>) {
  return new AyushService(
    repository as never,
    { rebuild: vi.fn().mockResolvedValue({ projectedEventCount: 1 }) } as never,
    { verify: () => "session-a" } as never,
    { verify: () => "authenticated-doctor" } as never,
  );
}

function baseRepository() {
  return {
    sessionOwns: vi
      .fn()
      .mockResolvedValue({ id: "session-a", visitId: "visit-1" }),
    activeDoctor: vi.fn().mockResolvedValue({
      id: "authenticated-doctor",
      displayName: "Dr Test",
      role: "DOCTOR",
    }),
    assigned: vi.fn().mockResolvedValue(true),
    patientView: vi.fn(),
    create: vi.fn(),
    find: vi.fn(),
    documentContext: vi.fn(),
    upsertDocument: vi.fn(),
    supersedeMissingDocumentRecords: vi.fn(),
  };
}

function record() {
  const now = new Date("2026-09-10T00:00:00Z");
  return {
    id: "ayush-1",
    patientId: "patient-1",
    visitId: "visit-1",
    interviewId: null,
    documentId: null,
    documentFactId: null,
    system: "AYURVEDA",
    useStatus: "CURRENT",
    practitionerName: null,
    practitionerRegistrationId: null,
    facilityName: null,
    treatmentName: null,
    medicineName: null,
    originalName: "Documented name",
    normalizedName: "Documented name",
    ingredients: null,
    dosage: null,
    frequency: null,
    route: null,
    startDate: null,
    endDate: null,
    indicationAsReported: null,
    patientReportedReason: null,
    reportedEffect: null,
    reportedEffectOnset: null,
    temporalRelationship: null,
    originalStatement: null,
    source: "DOCTOR_ENTERED",
    verificationStatus: "NEEDS_REVIEW",
    verificationVersion: 0,
    evidenceReferences: [],
    notes: null,
    createdAt: now,
    updatedAt: now,
    document: null,
    documentFact: null,
    interview: null,
  };
}
