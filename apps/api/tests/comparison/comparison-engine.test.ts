import type {
  SnapshotFact,
  SnapshotPayload,
} from "../../src/comparison/types.js";
import { ComparisonEngine } from "../../src/comparison/comparison-engine.js";
import { FactNormalizer } from "../../src/comparison/fact-normalizer.js";
import {
  SnapshotBuilder,
  type SnapshotEvent,
} from "../../src/comparison/snapshot-builder.js";
import { describe, expect, it } from "vitest";

const engine = new ComparisonEngine();
const snapshot = (
  facts: SnapshotFact[],
  visitId = "visit",
): SnapshotPayload => ({
  version: "1.0.0",
  patientId: "patient",
  visitId,
  facts,
});
const fact = (overrides: Partial<SnapshotFact> = {}): SnapshotFact => ({
  eventId: "event",
  entityType: "OBSERVATION",
  entityKey: "hemoglobin",
  title: "Hemoglobin",
  fields: { value: 10.4, unit: "g/dL" },
  knowledgeState: "YES",
  source: "DOCUMENT_EXTRACTED",
  verificationStatus: "DOCUMENT_EXTRACTED",
  ...overrides,
});

describe("Phase 8 deterministic comparison engine", () => {
  it("calculates the synthetic hemoglobin delta without clinical interpretation", () => {
    const [change] = engine.compare(
      snapshot([fact()]),
      snapshot(
        [fact({ eventId: "current", fields: { value: 8.9, unit: "g/dL" } })],
        "current",
      ),
    );
    expect(change?.changeType).toBe("CHANGED");
    expect(change?.fieldChanges[0]).toMatchObject({
      absoluteDelta: -1.5,
      percentageDelta: -14.42,
      unit: "g/dl",
    });
    expect(change?.explanation).not.toMatch(/worsen|progress|diagnos|risk/i);
  });

  it("marks an entity present only now as new", () => {
    expect(
      engine.compare(snapshot([]), snapshot([fact()]))[0]?.changeType,
    ).toBe("NEW");
  });

  it("uses removed only as a descriptive no-longer-reported state", () => {
    const result = engine.compare(
      snapshot([fact({ entityType: "MEDICATION", entityKey: "metformin" })]),
      snapshot([]),
    )[0];
    expect(result).toMatchObject({
      changeType: "REMOVED",
      reasonCode: "NO_LONGER_REPORTED",
    });
    expect(result?.explanation).not.toMatch(/stopped|resolved/i);
  });

  it("does not infer allergy removal from absence", () => {
    expect(
      engine.compare(
        snapshot([fact({ entityType: "ALLERGY", entityKey: "penicillin" })]),
        snapshot([]),
      )[0],
    ).toMatchObject({
      changeType: "UNKNOWN",
      reasonCode: "NOT_RECORDED_CURRENTLY",
    });
  });

  it("distinguishes newly captured from new", () => {
    const previous = fact({
      entityType: "SYMPTOM",
      entityKey: "breathing difficulty",
      knowledgeState: "NOT_ASKED",
      fields: {},
    });
    const current = fact({
      eventId: "current",
      entityType: "SYMPTOM",
      entityKey: "breathing difficulty",
      knowledgeState: "YES",
      fields: {},
    });
    expect(
      engine.compare(snapshot([previous]), snapshot([current]))[0]?.changeType,
    ).toBe("NEWLY_CAPTURED");
  });

  it("preserves unknown rather than filling a missing current value", () => {
    expect(
      engine.compare(
        snapshot([fact()]),
        snapshot([fact({ eventId: "current", knowledgeState: "UNKNOWN" })]),
      )[0]?.changeType,
    ).toBe("UNKNOWN");
  });

  it("classifies incompatible units as not comparable", () => {
    const current = fact({
      eventId: "current",
      fields: { value: 9, unit: "mmol/L" },
    });
    expect(
      engine.compare(snapshot([fact()]), snapshot([current]))[0],
    ).toMatchObject({ changeType: "NOT_COMPARABLE", needsReview: true });
  });

  it("normalizes controlled mass units and reports unchanged", () => {
    const previous = fact({ fields: { value: 1000, unit: "mg" } });
    const current = fact({
      eventId: "current",
      fields: { value: 1, unit: "g" },
    });
    expect(
      engine.compare(snapshot([previous]), snapshot([current]))[0]?.changeType,
    ).toBe("UNCHANGED");
  });

  it("flags a differing unverified value against a doctor-verified source", () => {
    const previous = fact({ verificationStatus: "DOCTOR_VERIFIED" });
    const current = fact({
      eventId: "current",
      fields: { value: 8.9, unit: "g/dL" },
      verificationStatus: "CAPTURED",
    });
    expect(
      engine.compare(snapshot([previous]), snapshot([current]))[0],
    ).toMatchObject({ changeType: "CONFLICTED", needsReview: true });
  });

  it("flags duplicate entity records deterministically", () => {
    const result = engine.compare(
      snapshot([fact(), fact({ eventId: "duplicate" })]),
      snapshot([fact({ eventId: "current" })]),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      changeType: "CONFLICTED",
      reasonCode: "DUPLICATE_FACTS",
    });
  });

  it("is deterministic for the same snapshots", () => {
    const previous = snapshot([fact({ entityKey: "hb" })]);
    const current = snapshot([
      fact({
        eventId: "current",
        entityKey: "hb",
        fields: { value: 9, unit: "g/dL" },
      }),
    ]);
    expect(engine.compare(previous, current)).toEqual(
      engine.compare(previous, current),
    );
    expect(new FactNormalizer().key("Hb")).toBe("hemoglobin");
  });

  it("builds stable immutable snapshot payloads and excludes rejected events", () => {
    const builder = new SnapshotBuilder();
    const event = (
      status: SnapshotEvent["verificationStatus"],
      id: string,
    ): SnapshotEvent => ({
      id,
      eventType: "LAB_RESULT",
      title: "Hb",
      normalizedKey: "hb",
      normalizedValue: { testName: "Hb", value: 10 },
      originalValue: null,
      source: "DOCUMENT_EXTRACTED",
      sourceType: "DOCUMENT_FACT",
      sourceId: id,
      sourceText: null,
      eventDate: new Date("2026-05-10T00:00:00Z"),
      recordedAt: new Date("2026-05-10T00:00:00Z"),
      updatedAt: new Date("2026-05-10T00:00:00Z"),
      verificationStatus: status,
      documentId: null,
      documentFactId: null,
      pageNumber: null,
    });
    const events = [
      event("DOCUMENT_EXTRACTED", "accepted"),
      event("REJECTED", "rejected"),
    ];
    const first = builder.build("patient", "visit", events);
    expect(first.facts).toHaveLength(1);
    expect(first.facts[0]?.entityKey).toBe("hemoglobin");
    expect(builder.hash(first)).toBe(
      builder.hash(builder.build("patient", "visit", events)),
    );
  });
});
