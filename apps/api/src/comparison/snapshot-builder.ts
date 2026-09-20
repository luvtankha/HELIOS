import type {
  ComparisonEntityType,
  TimelineEventStatus,
  TimelineEventType,
  TimelineSource,
} from "@prisma/client";
import { FactNormalizer } from "./fact-normalizer.js";
import type { KnowledgeState, SnapshotFact, SnapshotPayload } from "./types.js";

export interface SnapshotEvent {
  id: string;
  eventType: TimelineEventType;
  title: string;
  normalizedKey: string;
  normalizedValue: unknown;
  originalValue: unknown;
  source: TimelineSource;
  sourceType: string;
  sourceId: string;
  sourceText: string | null;
  eventDate: Date | null;
  recordedAt: Date;
  updatedAt: Date;
  verificationStatus: TimelineEventStatus;
  documentId: string | null;
  documentFactId: string | null;
  pageNumber: number | null;
}

export class SnapshotBuilder {
  static readonly VERSION = "1.0.0";
  constructor(private readonly normalizer = new FactNormalizer()) {}

  build(
    patientId: string,
    visitId: string,
    events: SnapshotEvent[],
  ): SnapshotPayload {
    const facts = events
      .filter((event) => event.verificationStatus !== "REJECTED")
      .flatMap((event) => {
        const entityType = mapType(event.eventType);
        if (!entityType) return [];
        const raw = event.normalizedValue ?? event.originalValue;
        const fields = this.normalizer.canonicalFields(raw);
        const entityKey = this.normalizer.key(
          concept(fields) ?? event.normalizedKey ?? event.title,
        );
        const state = knowledgeState(fields.state ?? fields.status);
        delete fields.state;
        delete fields.status;
        const fact: SnapshotFact = {
          eventId: event.id,
          entityType,
          entityKey,
          title: event.title,
          fields,
          knowledgeState: state,
          source: event.source,
          verificationStatus: event.verificationStatus,
          eventDate: (event.eventDate ?? event.recordedAt).toISOString(),
          ...(event.sourceText && { sourceText: event.sourceText }),
          ...(event.documentId && { documentId: event.documentId }),
          ...(event.documentFactId && { documentFactId: event.documentFactId }),
          ...(event.pageNumber !== null && { pageNumber: event.pageNumber }),
          ...(event.eventType === "RISK_SIGNAL" && {
            riskSignalId: event.sourceId,
          }),
        };
        return [fact];
      })
      .sort((left, right) =>
        `${left.entityType}:${left.entityKey}:${left.eventId}`.localeCompare(
          `${right.entityType}:${right.entityKey}:${right.eventId}`,
        ),
      );
    return { version: SnapshotBuilder.VERSION, patientId, visitId, facts };
  }

  revision(events: SnapshotEvent[]) {
    return this.normalizer.hash(
      events.map((event) => ({
        id: event.id,
        fingerprint: event.normalizedKey,
        value: event.normalizedValue,
        status: event.verificationStatus,
        updatedAt: event.updatedAt.toISOString(),
      })),
    );
  }

  hash(snapshot: SnapshotPayload) {
    return this.normalizer.hash(snapshot);
  }
}

function mapType(type: TimelineEventType): ComparisonEntityType | undefined {
  if (type === "PATIENT_REPORTED_SYMPTOM") return "SYMPTOM";
  if (["MEDICATION_RECORDED", "MEDICATION_CHANGED"].includes(type))
    return "MEDICATION";
  if (type === "ALLERGY_RECORDED") return "ALLERGY";
  if (["LAB_RESULT", "OBSERVATION"].includes(type)) return "OBSERVATION";
  if (type === "CLINICAL_HISTORY_UPDATE") return "CLINICAL_HISTORY_FIELD";
  if (
    ["MEDICAL_DOCUMENT", "CONSULTATION_NOTE", "DISCHARGE_EVENT"].includes(type)
  )
    return "DOCUMENT";
  if (type === "RISK_SIGNAL") return "RISK_SIGNAL";
  if (type === "AYUSH_TREATMENT") return "AYUSH_RECORD";
  return undefined;
}

function concept(fields: Record<string, unknown>) {
  const value =
    fields.name ?? fields.testName ?? fields.conceptKey ?? fields.medication;
  return typeof value === "string" ? value : undefined;
}

function knowledgeState(value: unknown): KnowledgeState {
  const state = typeof value === "string" ? value.toUpperCase() : "YES";
  return ["YES", "NO", "UNKNOWN", "NOT_ASKED"].includes(state)
    ? (state as KnowledgeState)
    : "YES";
}
