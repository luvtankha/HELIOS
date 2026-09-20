import { describe, expect, it } from "vitest";
import { ClinicalBriefBuilder } from "../../src/clinical-brief/clinical-brief-builder.js";
import type { BriefInput } from "../../src/clinical-brief/types.js";
import { ComparisonEngine } from "../../src/comparison/comparison-engine.js";
import type { SnapshotPayload } from "../../src/comparison/types.js";
import { TimelineEventBuilder } from "../../src/timeline/timeline-event-builder.js";

describe("verification downstream integrations", () => {
  it("projects doctor verification while retaining patient-reported source", () => {
    const event = new TimelineEventBuilder().medication({
      id: "medication",
      patientId: "patient",
      visitId: "visit",
      name: "Metformin",
      normalizedName: "metformin",
      dose: "1000 mg",
      frequency: "twice daily",
      source: "PATIENT_REPORTED",
      verifiedAt: new Date("2026-09-10T00:00:00Z"),
      verificationStatus: "DOCTOR_VERIFIED",
      createdAt: new Date("2026-09-09T00:00:00Z"),
    });
    expect(event.source).toBe("PATIENT_REPORTED");
    expect(event.verificationStatus).toBe("DOCTOR_VERIFIED");
    expect(event.recordedAt.toISOString()).toBe("2026-09-09T00:00:00.000Z");
  });

  it("rebuilds rejected source facts as rejected without deleting provenance", () => {
    const event = new TimelineEventBuilder().documentFact({
      id: "fact",
      patientId: "patient",
      visitId: "visit",
      documentId: "document",
      documentDate: new Date("2026-05-10T00:00:00Z"),
      factType: "allergy",
      originalValue: "Penicillin allergy",
      normalizedValue: { allergen: "Penicillin" },
      confidence: 0.8,
      status: "REJECTED",
      verificationStatus: "DOCTOR_REJECTED",
      createdAt: new Date("2026-05-10T00:00:00Z"),
      evidence: [{ pageNumber: 1, sourceText: "Allergy: Penicillin" }],
    });
    expect(event.verificationStatus).toBe("REJECTED");
    expect(event.sourceText).toBe("Allergy: Penicillin");
    expect(event.documentFactId).toBe("fact");
  });

  it("keeps the change after current medication becomes doctor verified", () => {
    const snapshot = (
      visitId: string,
      dose: string,
      verificationStatus: "DOCTOR_VERIFIED" | "DOCUMENT_EXTRACTED",
    ): SnapshotPayload => ({
      version: "1",
      patientId: "patient",
      visitId,
      facts: [
        {
          eventId: visitId,
          entityType: "MEDICATION",
          entityKey: "metformin",
          title: "Metformin",
          fields: { dose, frequency: "twice daily" },
          knowledgeState: "YES",
          source:
            visitId === "current" ? "PATIENT_REPORTED" : "DOCUMENT_EXTRACTED",
          verificationStatus,
        },
      ],
    });
    const [change] = new ComparisonEngine().compare(
      snapshot("previous", "500 mg", "DOCTOR_VERIFIED"),
      snapshot("current", "1000 mg", "DOCTOR_VERIFIED"),
    );
    expect(change?.changeType).toBe("CHANGED");
    expect(change?.current?.verificationStatus).toBe("DOCTOR_VERIFIED");
    expect(change?.needsReview).toBe(false);
  });

  it("renders a verified brief claim without changing its source", () => {
    const input: BriefInput = {
      patient: {
        id: "patient",
        fullName: "Aarav Sharma",
        patientCode: "SYNTHETIC",
        age: 24,
        sex: "MALE",
        preferredLanguage: "hi",
      },
      visit: { id: "visit", startedAt: new Date("2026-09-09T00:00:00Z") },
      symptoms: [],
      medications: [
        {
          id: "medication",
          name: "Metformin",
          dose: "1000 mg",
          frequency: "twice daily",
          visitId: "visit",
          source: "PATIENT_REPORTED",
          verificationStatus: "DOCTOR_VERIFIED",
        },
      ],
      allergies: [],
      observations: [],
      documents: [],
      history: [],
      safetyAvailable: false,
      riskSignals: [],
    };
    const claim = new ClinicalBriefBuilder()
      .build(input)
      .claims.find((item) => item.claimKey === "medication:medication");
    expect(claim).toMatchObject({
      sourceType: "PATIENT_REPORTED",
      verificationStatus: "DOCTOR_VERIFIED",
      needsVerification: false,
    });
  });
});
