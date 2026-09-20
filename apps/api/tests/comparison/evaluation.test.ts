import { ComparisonEngine } from "../../src/comparison/comparison-engine.js";
import type {
  SnapshotFact,
  SnapshotPayload,
} from "../../src/comparison/types.js";
import { describe, expect, it } from "vitest";

const base: SnapshotFact = {
  eventId: "p",
  entityType: "OBSERVATION",
  entityKey: "synthetic",
  title: "Synthetic fact",
  fields: { value: 1, unit: "mg" },
  knowledgeState: "YES",
  source: "SYSTEM_GENERATED",
  verificationStatus: "CAPTURED",
};
const snap = (facts: SnapshotFact[]): SnapshotPayload => ({
  version: "1.0.0",
  patientId: "synthetic-patient",
  visitId: "synthetic-visit",
  facts,
});

describe("synthetic-only comparison evaluation", () => {
  it("meets the deterministic category fixture threshold", () => {
    const fixtures = [
      {
        previous: [base],
        current: [{ ...base, eventId: "c", fields: { value: 2, unit: "mg" } }],
        expected: "CHANGED",
      },
      { previous: [], current: [base], expected: "NEW" },
      { previous: [base], current: [], expected: "REMOVED" },
      {
        previous: [base],
        current: [{ ...base, eventId: "c" }],
        expected: "UNCHANGED",
      },
      {
        previous: [base],
        current: [
          { ...base, eventId: "c", fields: { value: 2, unit: "mmol/L" } },
        ],
        expected: "NOT_COMPARABLE",
      },
    ];
    const engine = new ComparisonEngine();
    const correct = fixtures.filter(
      (fixture) =>
        engine.compare(snap(fixture.previous), snap(fixture.current))[0]
          ?.changeType === fixture.expected,
    ).length;
    const accuracy = correct / fixtures.length;
    expect(accuracy).toBe(1);
  });
});
