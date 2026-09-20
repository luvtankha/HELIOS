import { EntityMatcher } from "./entity-matcher.js";
import { FieldComparator } from "./field-comparator.js";
import type { EngineChange, SnapshotFact, SnapshotPayload } from "./types.js";

export const COMPARISON_ENGINE_VERSION = "phase8-v1";

export class ComparisonEngine {
  constructor(
    private readonly matcher = new EntityMatcher(),
    private readonly comparator = new FieldComparator(),
  ) {}

  compare(previous: SnapshotPayload, current: SnapshotPayload): EngineChange[] {
    return this.matcher.match(previous.facts, current.facts).map((pair) => {
      const entityType = (pair.current ?? pair.previous)!.entityType;
      const entityKey = (pair.current ?? pair.previous)!.entityKey;
      if (pair.duplicate)
        return change(
          entityType,
          entityKey,
          "CONFLICTED",
          "DUPLICATE_FACTS",
          pair.previous,
          pair.current,
          [],
          true,
        );
      if (!pair.previous)
        return change(
          entityType,
          entityKey,
          "NEW",
          "FIRST_RECORDED",
          undefined,
          pair.current,
          [],
        );
      if (!pair.current) {
        if (entityType === "ALLERGY")
          return change(
            entityType,
            entityKey,
            "UNKNOWN",
            "NOT_RECORDED_CURRENTLY",
            pair.previous,
            undefined,
            [],
          );
        return change(
          entityType,
          entityKey,
          "REMOVED",
          "NO_LONGER_REPORTED",
          pair.previous,
          undefined,
          [],
        );
      }
      if (
        ["UNKNOWN", "NOT_ASKED"].includes(pair.previous.knowledgeState) &&
        ["YES", "NO"].includes(pair.current.knowledgeState)
      )
        return change(
          entityType,
          entityKey,
          "NEWLY_CAPTURED",
          "PREVIOUSLY_NOT_KNOWN",
          pair.previous,
          pair.current,
          [],
        );
      if (
        ["YES", "NO"].includes(pair.previous.knowledgeState) &&
        ["UNKNOWN", "NOT_ASKED"].includes(pair.current.knowledgeState)
      )
        return change(
          entityType,
          entityKey,
          "UNKNOWN",
          "CURRENT_VALUE_UNKNOWN",
          pair.previous,
          pair.current,
          [],
        );

      const fields = this.comparator.compare(pair.previous, pair.current);
      if (fields.some((field) => !field.comparable))
        return change(
          entityType,
          entityKey,
          "NOT_COMPARABLE",
          "INCOMPATIBLE_VALUES",
          pair.previous,
          pair.current,
          fields,
          true,
        );
      if (!fields.length)
        return change(
          entityType,
          entityKey,
          "UNCHANGED",
          "SAME_NORMALIZED_VALUE",
          pair.previous,
          pair.current,
          fields,
        );
      if (
        pair.previous.verificationStatus === "DOCTOR_VERIFIED" &&
        pair.current.verificationStatus !== "DOCTOR_VERIFIED"
      )
        return change(
          entityType,
          entityKey,
          "CONFLICTED",
          "UNVERIFIED_VALUE_DIFFERS_FROM_VERIFIED",
          pair.previous,
          pair.current,
          fields,
          true,
        );
      return change(
        entityType,
        entityKey,
        "CHANGED",
        "NORMALIZED_VALUE_CHANGED",
        pair.previous,
        pair.current,
        fields,
      );
    });
  }
}

function change(
  entityType: EngineChange["entityType"],
  entityKey: string,
  changeType: EngineChange["changeType"],
  reasonCode: string,
  previous?: SnapshotFact,
  current?: SnapshotFact,
  fieldChanges: EngineChange["fieldChanges"] = [],
  needsReview = false,
): EngineChange {
  const label = current?.title ?? previous?.title ?? entityKey;
  const explanation = templates[changeType](label);
  return {
    entityType,
    entityKey,
    changeType,
    reasonCode,
    ...(previous && { previous }),
    ...(current && { current }),
    fieldChanges,
    matchConfidence: previous && current ? "HIGH" : "NONE",
    needsReview,
    explanation,
  };
}

const templates: Record<EngineChange["changeType"], (label: string) => string> =
  {
    NEW: (label) =>
      `${label} is recorded in the current visit and not in the previous visit.`,
    REMOVED: (label) =>
      `${label} was recorded previously and is not reported in the current visit.`,
    CHANGED: (label) =>
      `${label} has a different recorded value in the current visit.`,
    UNCHANGED: (label) =>
      `${label} has the same normalized value in both visits.`,
    CONFLICTED: (label) => `${label} has conflicting records and needs review.`,
    UNKNOWN: (label) =>
      `${label} cannot be determined from the current visit record.`,
    NOT_COMPARABLE: (label) =>
      `${label} uses values that cannot be compared safely.`,
    NEWLY_CAPTURED: (label) =>
      `${label} is known now but was unknown or not asked previously.`,
  };
