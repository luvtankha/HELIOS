import { describe, expect, it } from "vitest";
import { TimelineAggregator } from "../src/timeline/timeline-aggregator.js";
import { TimelineConflictService } from "../src/timeline/timeline-conflict-service.js";
import { TimelineEventBuilder } from "../src/timeline/timeline-event-builder.js";

const builder = new TimelineEventBuilder();

describe("longitudinal timeline engine", () => {
  it("keeps unknown dates unknown instead of manufacturing dates", () => {
    const event = builder.build({
      patientId: "patient-123",
      eventType: "CLINICAL_HISTORY_UPDATE",
      title: "Historical operation",
      source: "PATIENT_REPORTED",
      sourceType: "CLINICAL_HISTORY",
      sourceId: "history-123",
      temporalText: "about three years ago",
      verificationStatus: "CAPTURED",
      temporalState: "HISTORICAL",
      recordedAt: new Date("2026-09-09T00:00:00Z"),
    });
    expect(event.eventDate).toBeUndefined();
    expect(event.datePrecision).toBe("UNKNOWN");
    expect(event.temporalText).toBe("about three years ago");
  });

  it("marks medicine from a historical document as historical, not current or started", () => {
    const event = builder.documentFact({
      id: "fact-123",
      patientId: "patient-123",
      visitId: null,
      documentId: "document-123",
      documentDate: new Date("2024-01-01T00:00:00Z"),
      factType: "medication",
      originalValue: "Metformin 500 mg",
      normalizedValue: { name: "Metformin", dose: "500 mg" },
      confidence: 0.92,
      status: "EXTRACTED",
      createdAt: new Date("2026-09-09T00:00:00Z"),
      evidence: [{ pageNumber: 1, sourceText: "Metformin 500 mg" }],
    });
    expect(event.eventType).toBe("MEDICATION_RECORDED");
    expect(event.temporalState).toBe("HISTORICAL");
    expect(event.medicationAction).toBe("REPORTED");
    expect(event.verificationStatus).toBe("DOCUMENT_EXTRACTED");
    expect(event.title.toLowerCase()).not.toContain("started");
  });

  it("preserves month, year and range precision without manufacturing a time", () => {
    const month = builder.build({
      patientId: "patient-123",
      eventType: "PROCEDURE",
      title: "Historical procedure",
      eventDate: new Date("2020-05-01T00:00:00Z"),
      datePrecision: "MONTH_ONLY",
      source: "PATIENT_REPORTED",
      sourceType: "CLINICAL_HISTORY",
      sourceId: "procedure-month",
      verificationStatus: "CAPTURED",
      temporalState: "HISTORICAL",
      recordedAt: new Date("2026-09-09T00:00:00Z"),
    });
    const range = builder.build({
      patientId: "patient-123",
      eventType: "MEDICATION_CHANGED",
      title: "Medicine course",
      eventDate: new Date("2020-01-01T00:00:00Z"),
      eventEndDate: new Date("2020-03-01T00:00:00Z"),
      datePrecision: "DATE_RANGE",
      source: "CLINICAL_RECORD",
      sourceType: "MEDICATION",
      sourceId: "medicine-range",
      verificationStatus: "CAPTURED",
      temporalState: "HISTORICAL",
      recordedAt: new Date("2026-09-09T00:00:00Z"),
    });
    expect(month.datePrecision).toBe("MONTH_ONLY");
    expect(range.datePrecision).toBe("DATE_RANGE");
    expect(range.eventEndDate?.toISOString()).toContain("2020-03-01");
  });

  it("generates stable source-aware fingerprints", () => {
    const input = {
      patientId: "patient-123",
      eventType: "LAB_RESULT" as const,
      title: "Hemoglobin",
      source: "DOCUMENT_EXTRACTED" as const,
      sourceType: "DOCUMENT_FACT",
      sourceId: "fact-123",
      verificationStatus: "DOCUMENT_EXTRACTED" as const,
      temporalState: "HISTORICAL" as const,
      normalizedKey: "hemoglobin",
      recordedAt: new Date("2026-09-09T00:00:00Z"),
    };
    expect(builder.build(input).fingerprint).toBe(
      builder.build(input).fingerprint,
    );
    expect(builder.build(input).fingerprint).not.toBe(
      builder.build({ ...input, sourceId: "a-different-source" }).fingerprint,
    );
  });

  it("flags differing values without merging their records", () => {
    const service = new TimelineConflictService();
    const conflicts = service.conflictKeys([
      {
        conflictKey: "patient:MEDICATION_RECORDED:metformin",
        normalizedValue: { dose: "500 mg" },
        originalValue: null,
      },
      {
        conflictKey: "patient:MEDICATION_RECORDED:metformin",
        normalizedValue: { dose: "1000 mg" },
        originalValue: null,
      },
    ]);
    expect(conflicts.has("patient:MEDICATION_RECORDED:metformin")).toBe(true);
  });

  it("groups report facts under one source document", () => {
    const event = {
      id: "event-123",
      eventType: "LAB_RESULT" as const,
      title: "Hemoglobin",
      recordedAt: "2026-09-09T00:00:00.000Z",
      datePrecision: "EXACT_DATE" as const,
      temporalState: "HISTORICAL" as const,
      source: "DOCUMENT_EXTRACTED" as const,
      sourceLabel: "Document",
      sourceType: "DOCUMENT_FACT",
      sourceId: "fact-123",
      verificationStatus: "DOCUMENT_EXTRACTED" as const,
      confidenceBand: "HIGH" as const,
      groupKey: "document:123",
      hasConflict: false,
    };
    const groups = new TimelineAggregator().group([
      event,
      { ...event, id: "event-456", title: "WBC", sourceId: "fact-456" },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.events).toHaveLength(2);
  });
});
