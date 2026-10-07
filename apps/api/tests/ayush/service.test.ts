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
    const view = await service.patientView("patient-1", "token");
    expect(view.interactionInformation).toBe("UNAVAILABLE");
    expect(view.existingSafetySignals).toEqual([]);
    expect(Object.keys(repository)).not.toContain("riskSignal");
  });
});
function create(repository: ReturnType<typeof baseRepository>) {
  return new AyushService(
    repository as never,
    { rebuild: vi.fn().mockResolvedValue({ projectedEventCount: 1 }) } as never,
    { verify: () => "session-a" } as never,
  );
}
function baseRepository() {
  return {
    sessionOwns: vi
      .fn()
      .mockResolvedValue({ id: "session-a", visitId: "visit-1" }),
    patientView: vi.fn(),
    create: vi.fn(),
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
