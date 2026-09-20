import { describe, expect, it, vi } from "vitest";
import { VerificationService } from "../../src/verification/verification-service.js";
import type { ReviewableFact } from "../../src/verification/types.js";

describe("AYUSH Doctor Verification integration", () => {
  it("surfaces different current names in the same system as an evidence-first conflict", async () => {
    const facts = [
      fact("one", "Medicine X", "PATIENT_REPORTED"),
      fact("two", "Medicine Y", "DOCUMENT_EXTRACTED"),
    ];
    const repository = {
      doctor: vi
        .fn()
        .mockResolvedValue({ id: "doctor-1", displayName: "Dr Test" }),
      listFacts: vi.fn().mockResolvedValue(facts),
      assignedPatientIds: vi.fn().mockResolvedValue(["patient-1"]),
      riskVisitIds: vi.fn().mockResolvedValue([]),
      metrics: vi.fn().mockResolvedValue({
        verifiedToday: 0,
        correctedToday: 0,
        rejectedToday: 0,
      }),
    };
    const service = new VerificationService(
      repository as never,
      { rebuild: vi.fn() } as never,
      { read: vi.fn(), store: vi.fn() } as never,
      { verify: () => "doctor-1" } as never,
    );
    const queue = await service.queue(undefined, { limit: 20 }, "signed");
    expect(queue.items).toHaveLength(2);
    expect(queue.items.every((item) => item.conflict)).toBe(true);
    expect(queue.items.every((item) => item.factType === "AYUSH_RECORD")).toBe(
      true,
    );
  });

  it("keeps source provenance separate from doctor verification state", async () => {
    const ayush = fact("one", "Patient wording", "PATIENT_REPORTED");
    expect(ayush.sourceType).toBe("PATIENT_REPORTED");
    expect(ayush.verificationStatus).toBe("NEEDS_REVIEW");
  });
});

function fact(
  id: string,
  name: string,
  source: ReviewableFact["sourceType"],
): ReviewableFact {
  return {
    factType: "AYUSH_RECORD",
    factId: id,
    patientId: "patient-1",
    patientName: "Aarav Sharma",
    patientCode: "A1",
    visitId: "visit-1",
    label: `Ayurveda · ${name}`,
    value: { system: "AYURVEDA", useStatus: "CURRENT", originalName: name },
    sourceType: source,
    verificationStatus: "NEEDS_REVIEW",
    version: 0,
    createdAt: new Date(id === "one" ? "2026-09-01" : "2026-09-02"),
    updatedAt: new Date("2026-09-02"),
    evidence: [
      {
        kind: source === "DOCUMENT_EXTRACTED" ? "DOCUMENT" : "INTERVIEW",
        sourceId: id,
        label: "Source",
        sourceText: name,
      },
    ],
    normalizedKey: `AYURVEDA:${name.toLowerCase()}`,
  };
}
