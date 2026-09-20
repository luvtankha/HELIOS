import type {
  TimelineEventDetailDto,
  TimelineEventDto,
  TimelinePageDto,
} from "@helios/shared";
import type {
  TimelineRepository,
  TimelineRecord,
} from "../repositories/timeline-repository.js";
import {
  sessionProof,
  type SessionProofService,
} from "../security/session-proof.js";
import { AppError } from "../utils/app-error.js";
import { TimelineAggregator } from "./timeline-aggregator.js";
import { TimelineAuditService } from "./timeline-audit-service.js";
import { TimelineConflictService } from "./timeline-conflict-service.js";
import { TimelineEventBuilder } from "./timeline-event-builder.js";
import { TimelineRebuildService } from "./timeline-rebuild-service.js";
import type { TimelineFilters } from "./types.js";

export interface TimelineOperations {
  list(
    filters: TimelineFilters,
    token: string | undefined,
    requestId?: string,
  ): Promise<TimelinePageDto>;
  detail(
    eventId: string,
    token: string | undefined,
    requestId?: string,
  ): Promise<TimelineEventDetailDto>;
  rebuild(
    patientId: string,
    token: string | undefined,
    requestId?: string,
  ): Promise<{ projectedEventCount: number }>;
  projectDocument(documentId: string): Promise<void>;
  removeDocument(documentId: string): Promise<void>;
}

export class TimelineService implements TimelineOperations {
  private readonly rebuildService: TimelineRebuildService;
  private readonly audit: TimelineAuditService;

  constructor(
    private readonly repository: TimelineRepository,
    private readonly proof: SessionProofService = sessionProof,
    private readonly aggregator = new TimelineAggregator(),
    private readonly conflicts = new TimelineConflictService(),
    private readonly builder = new TimelineEventBuilder(),
  ) {
    this.rebuildService = new TimelineRebuildService(repository, builder);
    this.audit = new TimelineAuditService(repository);
  }

  async list(
    filters: TimelineFilters,
    token: string | undefined,
    requestId?: string,
  ) {
    await this.authorize(filters.patientId, token);
    const result = await this.repository.list(filters);
    const conflictRows = await this.repository.conflictCandidates(
      filters.patientId,
      [...new Set(result.items.flatMap((item) => item.conflictKey ?? []))],
    );
    const conflicted = this.conflicts.conflictKeys(conflictRows);
    const events = result.items.map((item) =>
      serializeTimelineEvent(item, conflicted.has(item.conflictKey ?? "")),
    );
    await this.audit.viewed(filters.patientId, requestId);
    return {
      groups: this.aggregator.group(events),
      ...(result.nextCursor && { nextCursor: result.nextCursor }),
    };
  }

  async detail(eventId: string, token: string | undefined, requestId?: string) {
    const owner = await this.repository.patientForEvent(eventId);
    if (!owner)
      throw new AppError("Timeline event not found", 404, "TIMELINE_NOT_FOUND");
    await this.authorize(owner.patientId, token);
    const record = await this.repository.findOwned(eventId, owner.patientId);
    if (!record)
      throw new AppError("Timeline event not found", 404, "TIMELINE_NOT_FOUND");
    const candidates = record.conflictKey
      ? await this.repository.conflictCandidates(owner.patientId, [
          record.conflictKey,
        ])
      : [];
    const event = serializeTimelineEvent(
      record,
      this.conflicts.conflictKeys(candidates).has(record.conflictKey ?? ""),
    );
    await this.audit.viewed(owner.patientId, requestId);
    return {
      event,
      ...(record.visit && {
        relatedVisit: {
          id: record.visit.id,
          status: record.visit.status,
          startedAt: record.visit.startedAt.toISOString(),
        },
      }),
      ...(record.document && { relatedDocument: record.document }),
      ...(event.evidence && { evidence: event.evidence }),
      versions: record.versions.map((version) => ({
        version: version.version,
        changedAt: version.changedAt.toISOString(),
        changeReason: version.changeReason,
      })),
    };
  }

  async rebuild(
    patientId: string,
    token: string | undefined,
    requestId?: string,
  ) {
    await this.authorize(patientId, token);
    const result = await this.rebuildService.rebuild(patientId);
    await this.audit.rebuilt(patientId, result.projectedEventCount, requestId);
    return result;
  }

  async projectDocument(documentId: string) {
    const document = await this.repository.documentSnapshot(documentId);
    if (!document) return;
    const events = [
      this.builder.document(document),
      ...document.facts.map((fact) =>
        this.builder.documentFact({
          ...fact,
          documentDate: document.documentDate,
        }),
      ),
    ];
    await this.repository.upsertProjected(
      events,
      "DOCUMENT_INCREMENTAL_UPDATE",
    );
  }

  async removeDocument(documentId: string) {
    await this.repository.rejectDocument(documentId);
  }

  private async authorize(patientId: string, token: string | undefined) {
    const sessionId = this.proof.verify(token);
    if (!(await this.repository.authorizePatient(patientId, sessionId)))
      throw new AppError(
        "Timeline access is not available for this session",
        403,
        "TIMELINE_FORBIDDEN",
      );
  }
}

export function serializeTimelineEvent(
  record: TimelineRecord,
  hasConflict: boolean,
): TimelineEventDto {
  const evidence = record.documentFact?.evidence[0];
  const pageNumber = evidence?.pageNumber ?? record.pageNumber;
  const sourceText = evidence?.sourceText ?? record.sourceText;
  return {
    id: record.id,
    eventType: record.eventType,
    title: record.title,
    ...(record.description && { description: record.description }),
    ...(record.eventDate && { eventDate: record.eventDate.toISOString() }),
    ...(record.eventEndDate && {
      eventEndDate: record.eventEndDate.toISOString(),
    }),
    recordedAt: record.recordedAt.toISOString(),
    datePrecision: record.datePrecision,
    temporalState: record.temporalState,
    ...(record.medicationAction && {
      medicationAction: record.medicationAction,
    }),
    source: record.source,
    sourceLabel: sourceLabel(record.source),
    sourceType: record.sourceType,
    sourceId: record.sourceId,
    ...(record.temporalText && { temporalText: record.temporalText }),
    ...(record.visitId && { visitId: record.visitId }),
    ...(record.documentId && { documentId: record.documentId }),
    verificationStatus: record.verificationStatus,
    confidenceBand:
      record.confidence === null
        ? "UNKNOWN"
        : record.confidence >= 0.85
          ? "HIGH"
          : record.confidence >= 0.65
            ? "MEDIUM"
            : "LOW",
    ...(record.groupKey && { groupKey: record.groupKey }),
    hasConflict,
    ...(record.documentId && {
      evidence: {
        documentId: record.documentId,
        ...(record.documentFactId && { documentFactId: record.documentFactId }),
        ...(pageNumber !== null && pageNumber !== undefined && { pageNumber }),
        ...(sourceText && { sourceText }),
        ...(evidence?.boundingBox && {
          boundingBox: evidence.boundingBox as unknown as {
            x: number;
            y: number;
            width: number;
            height: number;
          },
        }),
      },
    }),
  };
}

function sourceLabel(source: TimelineEventDto["source"]) {
  const labels: Record<TimelineEventDto["source"], string> = {
    PATIENT_REPORTED: "Patient reported",
    VOICE_INTERVIEW: "Patient interview",
    DOCUMENT_EXTRACTED: "Document",
    CLINICAL_RECORD: "Clinical record",
    DOCTOR_VERIFIED: "Doctor verified",
    SYSTEM_GENERATED: "HELIOS system",
    SAFETY_ENGINE: "System-generated safety signal",
  };
  return labels[source];
}
