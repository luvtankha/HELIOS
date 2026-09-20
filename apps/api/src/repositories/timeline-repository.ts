import type {
  Prisma,
  PrismaClient,
  TimelineEventStatus,
  TimelineEventType,
  TimelineSource,
} from "@prisma/client";
import type {
  ProjectedTimelineEvent,
  TimelineFilters,
} from "../timeline/types.js";
import { requireDatabase } from "./database.js";

const timelineDetailInclude = {
  visit: { select: { id: true, status: true, startedAt: true } },
  document: { select: { id: true, fileName: true, documentType: true } },
  documentFact: {
    include: { evidence: { orderBy: { pageNumber: "asc" as const } } },
  },
  versions: { orderBy: { version: "desc" as const } },
} satisfies Prisma.TimelineEventInclude;

export type TimelineRecord = Prisma.TimelineEventGetPayload<{
  include: typeof timelineDetailInclude;
}>;

export class TimelineRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: Prisma.TimelineEventUncheckedCreateInput) {
    requireDatabase();
    return this.prisma.timelineEvent.create({ data });
  }

  async listForDoctor(patientId: string, take = 75) {
    requireDatabase();
    return this.prisma.timelineEvent.findMany({
      where: { patientId, verificationStatus: { not: "REJECTED" } },
      orderBy: [
        { eventDate: { sort: "desc", nulls: "last" } },
        { recordedAt: "desc" },
        { id: "desc" },
      ],
      take,
      include: timelineDetailInclude,
    });
  }

  async authorizePatient(patientId: string, sessionId: string) {
    requireDatabase();
    return this.prisma.patientSession.findFirst({
      where: { id: sessionId, patientId },
      select: { id: true },
    });
  }

  async list(filters: TimelineFilters) {
    requireDatabase();
    const where: Prisma.TimelineEventWhereInput = {
      patientId: filters.patientId,
      verificationStatus: filters.verificationStatus ?? { not: "REJECTED" },
      ...(filters.eventTypes
        ? { eventType: { in: filters.eventTypes } }
        : filters.eventType
          ? { eventType: filters.eventType }
          : {}),
      ...(filters.source && { source: filters.source }),
      ...((filters.from || filters.to) && {
        eventDate: {
          ...(filters.from && { gte: filters.from }),
          ...(filters.to && { lte: filters.to }),
        },
      }),
    };
    const rows = await this.prisma.timelineEvent.findMany({
      where,
      orderBy: [
        { eventDate: { sort: filters.sort, nulls: "last" } },
        { recordedAt: filters.sort },
        { createdAt: filters.sort },
        { id: filters.sort },
      ],
      ...(filters.cursor && {
        cursor: { id: decodeCursor(filters.cursor) },
        skip: 1,
      }),
      take: filters.limit + 1,
      include: timelineDetailInclude,
    });
    const hasMore = rows.length > filters.limit;
    const items = hasMore ? rows.slice(0, filters.limit) : rows;
    const last = items.at(-1);
    return {
      items,
      ...(hasMore && last && { nextCursor: encodeCursor(last.id) }),
    };
  }

  async findOwned(eventId: string, patientId: string) {
    requireDatabase();
    return this.prisma.timelineEvent.findFirst({
      where: { id: eventId, patientId },
      include: timelineDetailInclude,
    });
  }

  async patientForEvent(eventId: string) {
    requireDatabase();
    return this.prisma.timelineEvent.findUnique({
      where: { id: eventId },
      select: { patientId: true },
    });
  }

  async conflictCandidates(patientId: string, conflictKeys: string[]) {
    requireDatabase();
    if (!conflictKeys.length) return [];
    return this.prisma.timelineEvent.findMany({
      where: {
        patientId,
        conflictKey: { in: conflictKeys },
        verificationStatus: { not: "REJECTED" },
      },
      select: { conflictKey: true, normalizedValue: true, originalValue: true },
    });
  }

  async sourceSnapshot(patientId: string) {
    requireDatabase();
    return this.prisma.patientProfile.findUnique({
      where: { id: patientId },
      include: {
        visits: {
          include: {
            clinicalHistory: true,
            symptoms: true,
            riskSignals: true,
            verifications: true,
            interview: { include: { responses: true } },
          },
        },
        medications: true,
        allergies: true,
        observations: true,
        ayushRecords: true,
        documents: {
          where: {
            deletedAt: null,
            identityStatus: { not: "IDENTITY_MISMATCH" },
          },
          include: { facts: { include: { evidence: true } } },
        },
      },
    });
  }

  async documentSnapshot(documentId: string) {
    requireDatabase();
    return this.prisma.medicalDocument.findFirst({
      where: {
        id: documentId,
        deletedAt: null,
        identityStatus: { not: "IDENTITY_MISMATCH" },
      },
      include: { facts: { include: { evidence: true } } },
    });
  }

  async upsertProjected(events: ProjectedTimelineEvent[], reason: string) {
    requireDatabase();
    for (const event of events) {
      await this.prisma.$transaction(async (transaction) => {
        const existing = await transaction.timelineEvent.findUnique({
          where: { fingerprint: event.fingerprint },
          include: { _count: { select: { versions: true } } },
        });
        const data = projectedData(event);
        if (!existing) {
          await transaction.timelineEvent.create({ data });
          return;
        }
        const oldSnapshot = snapshot(existing);
        const newSnapshot = snapshot({ ...existing, ...data });
        if (JSON.stringify(oldSnapshot) === JSON.stringify(newSnapshot)) return;
        await transaction.timelineEventVersion.create({
          data: {
            timelineEventId: existing.id,
            version: existing._count.versions + 1,
            snapshot: oldSnapshot,
            changeReason: reason,
          },
        });
        await transaction.timelineEvent.update({
          where: { id: existing.id },
          data,
        });
      });
    }
  }

  async rejectMissing(patientId: string, activeFingerprints: string[]) {
    requireDatabase();
    return this.rejectWhere(
      {
        patientId,
        fingerprint: { notIn: activeFingerprints },
        verificationStatus: { not: "REJECTED" },
      },
      "SOURCE_REMOVED_DURING_REBUILD",
    );
  }

  async rejectDocument(documentId: string) {
    requireDatabase();
    return this.rejectWhere({ documentId }, "SOURCE_DOCUMENT_REMOVED");
  }

  async audit(input: {
    action: string;
    entityId: string;
    requestId?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    requireDatabase();
    return this.prisma.auditLog.create({
      data: {
        action: input.action,
        entityType: "TimelineEvent",
        entityId: input.entityId,
        ...(input.requestId && { requestId: input.requestId }),
        ...(input.metadata && { metadata: input.metadata }),
      },
    });
  }

  private async rejectWhere(
    where: Prisma.TimelineEventWhereInput,
    reason: string,
  ) {
    const rows = await this.prisma.timelineEvent.findMany({
      where,
      include: { _count: { select: { versions: true } } },
    });
    for (const row of rows) {
      if (row.verificationStatus === "REJECTED") continue;
      await this.prisma.$transaction([
        this.prisma.timelineEventVersion.create({
          data: {
            timelineEventId: row.id,
            version: row._count.versions + 1,
            snapshot: snapshot(row),
            changeReason: reason,
          },
        }),
        this.prisma.timelineEvent.update({
          where: { id: row.id },
          data: { verificationStatus: "REJECTED" },
        }),
      ]);
    }
    return { count: rows.length };
  }
}

function projectedData(
  event: ProjectedTimelineEvent,
): Prisma.TimelineEventUncheckedCreateInput {
  return {
    patientId: event.patientId,
    ...(event.visitId && { visitId: event.visitId }),
    ...(event.documentId && { documentId: event.documentId }),
    ...(event.documentFactId && { documentFactId: event.documentFactId }),
    eventType: event.eventType,
    title: event.title,
    ...(event.description && { description: event.description }),
    eventDate: event.eventDate ?? null,
    eventEndDate: event.eventEndDate ?? null,
    datePrecision: event.datePrecision,
    temporalState: event.temporalState,
    medicationAction: event.medicationAction ?? null,
    source: event.source,
    sourceType: event.sourceType,
    sourceId: event.sourceId,
    sourceText: event.sourceText ?? null,
    temporalText: event.temporalText ?? null,
    pageNumber: event.pageNumber ?? null,
    verificationStatus: event.verificationStatus,
    confidence: event.confidence ?? null,
    ...(event.originalValue !== undefined && {
      originalValue: event.originalValue as Prisma.InputJsonValue,
    }),
    ...(event.normalizedValue !== undefined && {
      normalizedValue: event.normalizedValue as Prisma.InputJsonValue,
    }),
    groupKey: event.groupKey ?? null,
    normalizedKey: event.normalizedKey,
    fingerprint: event.fingerprint,
    conflictKey: event.conflictKey ?? null,
    recordedAt: event.recordedAt,
  };
}

function snapshot(value: {
  title: string;
  description?: string | null;
  eventDate?: Date | string | null;
  eventEndDate?: Date | string | null;
  verificationStatus: TimelineEventStatus;
  temporalState: string;
  medicationAction?: string | null;
  normalizedValue?: unknown;
  originalValue?: unknown;
}): Prisma.InputJsonObject {
  return {
    title: value.title,
    description: value.description ?? null,
    eventDate: dateIso(value.eventDate),
    eventEndDate: dateIso(value.eventEndDate),
    verificationStatus: value.verificationStatus,
    temporalState: value.temporalState,
    medicationAction: value.medicationAction ?? "null",
    normalizedValue: json(value.normalizedValue),
    originalValue: json(value.originalValue),
  };
}

function json(value: unknown): Prisma.InputJsonValue {
  return value === undefined ? "null" : (value as Prisma.InputJsonValue);
}

function dateIso(value: Date | string | null | undefined) {
  if (!value) return "null";
  return typeof value === "string" ? value : value.toISOString();
}

function encodeCursor(id: string) {
  return Buffer.from(id, "utf8").toString("base64url");
}

function decodeCursor(cursor: string) {
  try {
    const id = Buffer.from(cursor, "base64url").toString("utf8");
    if (!id || id.length > 128) throw new Error("invalid cursor");
    return id;
  } catch {
    return "invalid-timeline-cursor";
  }
}

export type TimelineFilterPrisma = {
  eventType?: TimelineEventType;
  source?: TimelineSource;
  verificationStatus?: TimelineEventStatus;
};
