import type {
  ComparisonChangeType,
  ComparisonEntityType,
  MatchConfidence,
  TimelineEventStatus,
  TimelineSource,
} from "@prisma/client";

export type KnowledgeState = "YES" | "NO" | "UNKNOWN" | "NOT_ASKED";

export interface SnapshotFact {
  eventId: string;
  entityType: ComparisonEntityType;
  entityKey: string;
  title: string;
  fields: Record<string, unknown>;
  knowledgeState: KnowledgeState;
  source: TimelineSource;
  verificationStatus: TimelineEventStatus;
  eventDate?: string;
  sourceText?: string;
  documentId?: string;
  documentFactId?: string;
  pageNumber?: number;
  riskSignalId?: string;
}

export interface SnapshotPayload {
  version: string;
  patientId: string;
  visitId: string;
  facts: SnapshotFact[];
}

export interface FieldDelta {
  field: string;
  previousValue?: unknown;
  currentValue?: unknown;
  absoluteDelta?: number;
  percentageDelta?: number;
  unit?: string;
  comparable: boolean;
}

export interface EngineChange {
  entityType: ComparisonEntityType;
  entityKey: string;
  changeType: ComparisonChangeType;
  reasonCode: string;
  previous?: SnapshotFact;
  current?: SnapshotFact;
  fieldChanges: FieldDelta[];
  matchConfidence: MatchConfidence;
  needsReview: boolean;
  explanation: string;
}
