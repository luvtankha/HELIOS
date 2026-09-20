import type {
  ChangeRecordDto,
  ComparisonChangeType,
  ComparisonDto,
  ComparisonEntityType,
  ComparisonListItemDto,
  ComparisonSummaryDto,
  DoctorSessionDto,
} from "@helios/shared";
import type { Prisma } from "@prisma/client";
import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import type { ComparisonRepository } from "../repositories/comparison-repository.js";
import { DoctorProofService } from "../security/doctor-proof.js";
import { AppError } from "../utils/app-error.js";
import { securityEvent } from "../security/security-events.js";
import {
  ComparisonEngine,
  COMPARISON_ENGINE_VERSION,
} from "./comparison-engine.js";
import { FactNormalizer } from "./fact-normalizer.js";
import { SnapshotBuilder } from "./snapshot-builder.js";
import type { EngineChange } from "./types.js";

type DetailRow = NonNullable<
  Awaited<ReturnType<ComparisonRepository["detail"]>>
>;

export interface ComparisonOperations {
  signIn(username: string, accessCode: string): Promise<DoctorSessionDto>;
  patients(token?: string): Promise<unknown>;
  create(
    patientId: string,
    previousVisitId: string,
    currentVisitId: string,
    token?: string,
    requestId?: string,
  ): Promise<ComparisonDto>;
  quick(
    patientId: string,
    token?: string,
    requestId?: string,
  ): Promise<ComparisonDto>;
  detail(
    id: string,
    token?: string,
    requestId?: string,
  ): Promise<ComparisonDto>;
  list(
    patientId: string,
    limit: number,
    token?: string,
  ): Promise<ComparisonListItemDto[]>;
  changes(
    id: string,
    filters: {
      changeType?: ComparisonChangeType;
      entityType?: ComparisonEntityType;
      needsReview?: boolean;
    },
    token?: string,
  ): Promise<ChangeRecordDto[]>;
  change(
    id: string,
    changeId: string,
    token?: string,
  ): Promise<ChangeRecordDto>;
}

export class ComparisonService implements ComparisonOperations {
  constructor(
    private readonly repository: ComparisonRepository,
    private readonly proof = new DoctorProofService(),
    private readonly snapshots = new SnapshotBuilder(),
    private readonly engine = new ComparisonEngine(),
    private readonly normalizer = new FactNormalizer(),
  ) {}

  async signIn(
    username: string,
    accessCode: string,
  ): Promise<DoctorSessionDto> {
    if (
      !env.ENABLE_DEMO_MODE ||
      !sameSecret(accessCode, env.DOCTOR_DEMO_ACCESS_CODE)
    ) {
      securityEvent("AUTHENTICATION_FAILURE", {
        actorKey: username,
        routeGroup: "doctor-login",
      });
      throw new AppError(
        "Doctor demo sign-in failed",
        403,
        "DOCTOR_SIGN_IN_FAILED",
      );
    }
    const doctor = await this.repository.doctorByUsername(username);
    if (!doctor || doctor.role !== "DOCTOR") {
      securityEvent("AUTHENTICATION_FAILURE", {
        actorKey: username,
        routeGroup: "doctor-login",
      });
      throw new AppError(
        "Doctor demo sign-in failed",
        403,
        "DOCTOR_SIGN_IN_FAILED",
      );
    }
    return {
      doctorId: doctor.id,
      displayName: doctor.displayName,
      role: doctor.role as "DOCTOR" | "ADMIN",
      doctorToken: this.proof.create(doctor.id),
    };
  }

  async patients(token?: string) {
    const doctor = await this.authorize(token);
    const rows = await this.repository.patients(
      doctor.id,
      doctor.role === "ADMIN",
    );
    return rows.map((patient) => ({
      ...patient,
      visits: patient.visits.map((visit) => ({
        ...visit,
        startedAt: visit.startedAt.toISOString(),
      })),
    }));
  }

  async create(
    patientId: string,
    previousVisitId: string,
    currentVisitId: string,
    token?: string,
    requestId?: string,
  ) {
    const doctor = await this.authorize(token);
    await this.requireAssigned(doctor, patientId);
    if (previousVisitId === currentVisitId)
      throw new AppError(
        "Select two different visits",
        400,
        "COMPARISON_VISITS_MUST_DIFFER",
      );
    const visits = await this.repository.visits(patientId, [
      previousVisitId,
      currentVisitId,
    ]);
    if (visits.length !== 2)
      throw new AppError(
        "Both visits must belong to the selected patient",
        404,
        "COMPARISON_VISIT_NOT_FOUND",
      );
    const previousVisit = visits.find((visit) => visit.id === previousVisitId)!;
    const currentVisit = visits.find((visit) => visit.id === currentVisitId)!;
    if (previousVisit.startedAt >= currentVisit.startedAt)
      throw new AppError(
        "Previous visit must be earlier than current visit",
        400,
        "COMPARISON_VISIT_ORDER_INVALID",
      );

    const [previous, current] = await Promise.all([
      this.buildSnapshot(patientId, previousVisitId),
      this.buildSnapshot(patientId, currentVisitId),
    ]);
    const cacheKey = this.normalizer.hash({
      previous: previous.row.snapshotHash,
      current: current.row.snapshotHash,
      engine: COMPARISON_ENGINE_VERSION,
    });
    const cached = await this.repository.cached(cacheKey);
    if (cached) return serialize(cached);
    const changes = this.engine.compare(previous.payload, current.payload);
    const row = await this.repository.create(
      {
        patientId,
        previousVisitId,
        currentVisitId,
        previousSnapshotId: previous.row.id,
        currentSnapshotId: current.row.id,
        engineVersion: COMPARISON_ENGINE_VERSION,
        cacheKey,
        createdBy: doctor.id,
      },
      changes.map((change) => this.persistence(change)),
    );
    await this.repository.audit(
      doctor.id,
      "COMPARISON_GENERATED",
      row.id,
      requestId,
      {
        patientId,
        previousVisitId,
        currentVisitId,
        changeCount: changes.length,
      },
    );
    return serialize(row);
  }

  async quick(patientId: string, token?: string, requestId?: string) {
    const doctor = await this.authorize(token);
    await this.requireAssigned(doctor, patientId);
    const visits = await this.repository.visits(patientId);
    if (visits.length < 2)
      throw new AppError(
        "At least two visits are required",
        409,
        "COMPARISON_VISITS_REQUIRED",
      );
    return this.create(
      patientId,
      visits[1]!.id,
      visits[0]!.id,
      token,
      requestId,
    );
  }

  async detail(id: string, token?: string, requestId?: string) {
    const doctor = await this.authorize(token);
    let row = await this.repository.detail(id);
    if (!row)
      throw new AppError("Comparison not found", 404, "COMPARISON_NOT_FOUND");
    await this.requireAssigned(doctor, row.patientId);
    const [previousEvents, currentEvents] = await Promise.all([
      this.repository.events(row.patientId, row.previousVisitId),
      this.repository.events(row.patientId, row.currentVisitId),
    ]);
    if (
      this.snapshots.revision(previousEvents) !==
        row.previousSnapshot.sourceRevision ||
      this.snapshots.revision(currentEvents) !==
        row.currentSnapshot.sourceRevision
    )
      row = await this.repository.markStale(row.id);
    await this.repository.audit(
      doctor.id,
      "COMPARISON_VIEWED",
      row.id,
      requestId,
    );
    return serialize(row);
  }

  async list(patientId: string, limit: number, token?: string) {
    const doctor = await this.authorize(token);
    await this.requireAssigned(doctor, patientId);
    return (await this.repository.list(patientId, limit)).map((row) =>
      listItem(row),
    );
  }

  async changes(
    id: string,
    filters: {
      changeType?: ComparisonChangeType;
      entityType?: ComparisonEntityType;
      needsReview?: boolean;
    },
    token?: string,
  ) {
    const detail = await this.detail(id, token);
    return detail.changes.filter(
      (change) =>
        (!filters.changeType || change.changeType === filters.changeType) &&
        (!filters.entityType || change.entityType === filters.entityType) &&
        (filters.needsReview === undefined ||
          change.needsReview === filters.needsReview),
    );
  }

  async change(id: string, changeId: string, token?: string) {
    const changes = await this.changes(id, {}, token);
    const record = changes.find((item) => item.id === changeId);
    if (!record)
      throw new AppError(
        "Change record not found",
        404,
        "CHANGE_RECORD_NOT_FOUND",
      );
    return record;
  }

  private async authorize(token?: string) {
    const id = this.proof.verify(token);
    const doctor = await this.repository.doctor(id);
    if (!doctor)
      throw new AppError(
        "Doctor access is required",
        403,
        "DOCTOR_ROLE_REQUIRED",
      );
    return doctor;
  }

  private async requireAssigned(
    doctor: { id: string; role: string },
    patientId: string,
  ) {
    if (
      !(await this.repository.assigned(
        doctor.id,
        patientId,
        doctor.role === "ADMIN",
      ))
    ) {
      securityEvent("AUTHORIZATION_FAILURE", {
        actorKey: doctor.id,
        routeGroup: "comparisons",
      });
      throw new AppError(
        "Patient access is not authorized",
        403,
        "PATIENT_ACCESS_FORBIDDEN",
      );
    }
  }

  private async buildSnapshot(patientId: string, visitId: string) {
    const events = await this.repository.events(patientId, visitId);
    const payload = this.snapshots.build(patientId, visitId, events);
    const revision = this.snapshots.revision(events);
    const snapshotHash = this.snapshots.hash(payload);
    const sourceUpdatedAt = events.reduce(
      (latest, event) => (event.updatedAt > latest ? event.updatedAt : latest),
      new Date(0),
    );
    const row = await this.repository.snapshot(revision, {
      patientId,
      visitId,
      snapshotVersion: SnapshotBuilder.VERSION,
      sourceRevision: revision,
      snapshotHash,
      facts: payload as unknown as Prisma.InputJsonValue,
      eventCount: events.length,
      sourceUpdatedAt,
    });
    return { row, payload };
  }

  private persistence(
    change: EngineChange,
  ): Prisma.ChangeRecordUncheckedCreateWithoutComparisonInput {
    const evidence = (fact: EngineChange["current"]) =>
      fact && {
        timelineEventId: fact.eventId,
        source: fact.source,
        verificationStatus: fact.verificationStatus,
        ...(fact.eventDate && { eventDate: fact.eventDate }),
        ...(fact.documentId && { documentId: fact.documentId }),
        ...(fact.documentFactId && { documentFactId: fact.documentFactId }),
        ...(fact.pageNumber !== undefined && { pageNumber: fact.pageNumber }),
        ...(fact.sourceText && { sourceText: fact.sourceText }),
      };
    return {
      entityType: change.entityType,
      entityKey: change.entityKey,
      changeType: change.changeType,
      reason: change.reasonCode,
      fieldChanges: change.fieldChanges as unknown as Prisma.InputJsonValue,
      ...(change.previous && {
        previousValue: change.previous.fields as Prisma.InputJsonValue,
        previousEventId: change.previous.eventId,
        previousSource: change.previous.source,
        previousVerificationStatus: change.previous.verificationStatus,
        previousEvidence: evidence(change.previous) as Prisma.InputJsonValue,
      }),
      ...(change.current && {
        currentValue: change.current.fields as Prisma.InputJsonValue,
        currentEventId: change.current.eventId,
        currentSource: change.current.source,
        currentVerificationStatus: change.current.verificationStatus,
        currentEvidence: evidence(change.current) as Prisma.InputJsonValue,
      }),
      matchConfidence: change.matchConfidence,
      needsReview: change.needsReview,
      explanation: change.explanation,
      ...(change.current?.riskSignalId && {
        relatedRiskSignalId: change.current.riskSignalId,
      }),
      fingerprint: this.normalizer.hash({
        entityType: change.entityType,
        entityKey: change.entityKey,
        changeType: change.changeType,
        fields: change.fieldChanges,
      }),
    };
  }
}

function sameSecret(left: string, right: string) {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function serialize(row: DetailRow): ComparisonDto {
  return {
    ...listItem(row),
    patientId: row.patientId,
    patientName: row.patient.fullName,
    previousSnapshotId: row.previousSnapshotId,
    currentSnapshotId: row.currentSnapshotId,
    changes: row.changes.map(serializeChange),
  };
}
function listItem(row: DetailRow): ComparisonListItemDto {
  return {
    id: row.id,
    previousVisitId: row.previousVisitId,
    currentVisitId: row.currentVisitId,
    previousVisitDate: row.previousVisit.startedAt.toISOString(),
    currentVisitDate: row.currentVisit.startedAt.toISOString(),
    status: row.status,
    engineVersion: row.engineVersion,
    createdAt: row.createdAt.toISOString(),
    summary: summarize(row.changes),
  };
}
function serializeChange(
  change: DetailRow["changes"][number],
): ChangeRecordDto {
  const fieldChanges = change.fieldChanges as unknown as Array<{
    field: string;
    previousValue?: unknown;
    currentValue?: unknown;
    unit?: string;
    absoluteDelta?: number;
    percentageDelta?: number;
  }>;
  const previousEvidence =
    change.previousEvidence as unknown as ChangeRecordDto["previousEvidence"];
  const currentEvidence =
    change.currentEvidence as unknown as ChangeRecordDto["currentEvidence"];
  return {
    id: change.id,
    entityType: change.entityType,
    entityKey: change.entityKey,
    changeType: change.changeType,
    reason: change.reason,
    fieldChanges: fieldChanges.map((field) => ({
      field: field.field,
      ...(field.previousValue !== undefined && {
        previous: field.previousValue,
      }),
      ...(field.currentValue !== undefined && { current: field.currentValue }),
      ...(field.unit && { unit: field.unit }),
      ...(field.absoluteDelta !== undefined && {
        absoluteDelta: field.absoluteDelta,
      }),
      ...(field.percentageDelta !== undefined && {
        percentageChange: field.percentageDelta,
      }),
    })),
    ...(change.previousValue !== null && {
      previousValue: change.previousValue,
    }),
    ...(change.currentValue !== null && { currentValue: change.currentValue }),
    ...(change.previousSource && { previousSource: change.previousSource }),
    ...(change.currentSource && { currentSource: change.currentSource }),
    ...(change.previousVerificationStatus && {
      previousVerificationStatus: change.previousVerificationStatus,
    }),
    ...(change.currentVerificationStatus && {
      currentVerificationStatus: change.currentVerificationStatus,
    }),
    ...(previousEvidence && { previousEvidence }),
    ...(currentEvidence && { currentEvidence }),
    matchConfidence: change.matchConfidence,
    needsReview: change.needsReview,
    explanation: change.explanation,
    ...(change.relatedRiskSignalId && {
      relatedRiskSignalId: change.relatedRiskSignalId,
    }),
  };
}
function summarize(changes: DetailRow["changes"]): ComparisonSummaryDto {
  const count = (type: string) =>
    changes.filter((change) => change.changeType === type).length;
  return {
    newCount: count("NEW"),
    changedCount: count("CHANGED"),
    removedCount: count("REMOVED"),
    conflictCount: count("CONFLICTED"),
    unknownCount: count("UNKNOWN"),
    unchangedCount: count("UNCHANGED"),
    newlyCapturedCount: count("NEWLY_CAPTURED"),
    notComparableCount: count("NOT_COMPARABLE"),
    needsReviewCount: changes.filter((change) => change.needsReview).length,
  };
}
