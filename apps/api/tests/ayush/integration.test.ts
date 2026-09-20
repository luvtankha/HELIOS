import { describe, expect, it } from "vitest";
import { TimelineEventBuilder } from "../../src/timeline/timeline-event-builder.js";
import { SnapshotBuilder } from "../../src/comparison/snapshot-builder.js";
import { ClinicalBriefBuilder } from "../../src/clinical-brief/clinical-brief-builder.js";
import type { BriefInput } from "../../src/clinical-brief/types.js";

describe("AYUSH downstream integrations", () => {
  it("projects current use and a reported-after symptom without causal language", () => {
    const event = new TimelineEventBuilder().ayush(record());
    expect(event.eventType).toBe("AYUSH_TREATMENT");
    expect(event.temporalState).toBe("CURRENT");
    expect(event.description).toContain("Reported after treatment use: rash");
    expect(event.description).not.toMatch(/caused|cured|worsened|improved/i);
    expect(event.sourceType).toBe("AYUSH_RECORD");
  });

  it("keeps stopped use discontinued rather than current", () => {
    const event = new TimelineEventBuilder().ayush({
      ...record(),
      useStatus: "STOPPED",
    });
    expect(event.temporalState).toBe("DISCONTINUED");
  });

  it("makes AYUSH records comparable through What Changed", () => {
    const projected = new TimelineEventBuilder().ayush(record());
    const event = {
      id: "timeline-ayush",
      eventType: projected.eventType,
      title: projected.title,
      normalizedKey: projected.normalizedKey,
      normalizedValue: projected.normalizedValue,
      originalValue: projected.originalValue,
      source: projected.source,
      sourceType: projected.sourceType,
      sourceId: projected.sourceId,
      sourceText: null,
      eventDate: projected.eventDate ?? null,
      recordedAt: projected.recordedAt,
      updatedAt: projected.recordedAt,
      verificationStatus: projected.verificationStatus,
      documentId: null,
      documentFactId: null,
      pageNumber: null,
    };
    const snapshot = new SnapshotBuilder().build("patient-1", "visit-1", [
      event,
    ]);
    expect(snapshot.facts[0]?.entityType).toBe("AYUSH_RECORD");
  });

  it("adds a concise source-linked AYUSH Clinical Brief section", () => {
    const input: BriefInput = {
      patient: {
        id: "patient-1",
        fullName: "Aarav Sharma",
        patientCode: "A1",
        age: 24,
        sex: "MALE",
        preferredLanguage: "hi",
      },
      visit: { id: "visit-1", startedAt: new Date("2026-09-10T00:00:00Z") },
      symptoms: [],
      medications: [],
      allergies: [],
      observations: [],
      documents: [],
      history: [],
      ayushRecords: [
        {
          id: "ayush-1",
          system: "AYURVEDA",
          useStatus: "CURRENT",
          originalName: "Patient wording",
          source: "PATIENT_REPORTED",
          verificationStatus: "NEEDS_REVIEW",
          reportedEffect: "rash",
          temporalRelationship: "REPORTED_AFTER",
        },
      ],
      safetyAvailable: false,
      riskSignals: [],
    };
    const built = new ClinicalBriefBuilder().build(input);
    const claim = built.claims.find((item) => item.sectionType === "AYUSH_USE");
    expect(claim).toMatchObject({
      sourceType: "PATIENT_REPORTED",
      needsVerification: true,
    });
    expect(claim?.text).toContain("Reported after treatment use: rash");
    expect(claim?.text).not.toMatch(/caused|recommended|effective/i);
  });
});

function record() {
  return {
    id: "ayush-1",
    patientId: "patient-1",
    visitId: "visit-1",
    documentId: null,
    documentFactId: null,
    system: "AYURVEDA",
    useStatus: "CURRENT" as const,
    originalName: "Patient wording",
    normalizedName: "Patient wording",
    treatmentName: "Patient wording",
    medicineName: null,
    dosage: null,
    frequency: null,
    route: null,
    startDate: new Date("2026-09-01T00:00:00Z"),
    endDate: null,
    indicationAsReported: "joint pain",
    reportedEffect: "rash",
    temporalRelationship: "REPORTED_AFTER",
    source: "PATIENT_REPORTED" as const,
    verificationStatus: "NEEDS_REVIEW" as const,
    createdAt: new Date("2026-09-01T00:00:00Z"),
  };
}
