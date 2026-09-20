import type {
  TimelineDatePrecision,
  TimelineEventStatus,
  TimelineEventType,
  TimelineMedicationAction,
  TimelineSource,
  TimelineTemporalState,
} from "@prisma/client";

export interface ProjectedTimelineEvent {
  patientId: string;
  visitId?: string;
  documentId?: string;
  documentFactId?: string;
  eventType: TimelineEventType;
  title: string;
  description?: string;
  eventDate?: Date;
  eventEndDate?: Date;
  datePrecision: TimelineDatePrecision;
  temporalState: TimelineTemporalState;
  medicationAction?: TimelineMedicationAction;
  source: TimelineSource;
  sourceType: string;
  sourceId: string;
  sourceText?: string;
  temporalText?: string;
  pageNumber?: number;
  verificationStatus: TimelineEventStatus;
  confidence?: number;
  originalValue?: unknown;
  normalizedValue?: unknown;
  groupKey?: string;
  normalizedKey: string;
  fingerprint: string;
  conflictKey?: string;
  recordedAt: Date;
}

export interface TimelineFilters {
  patientId: string;
  from?: Date;
  to?: Date;
  eventType?: TimelineEventType;
  eventTypes?: TimelineEventType[];
  source?: TimelineSource;
  verificationStatus?: TimelineEventStatus;
  limit: number;
  cursor?: string;
  sort: "asc" | "desc";
}
