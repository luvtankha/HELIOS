import type {
  ClinicalVerificationStatus,
  VerificationActionResultDto,
  VerificationHistoryDto,
  VerificationQueueDto,
  VerificationQueueItemDto,
  VerificationReviewDto,
} from "@helios/shared";
import type { MedicalDocumentDto } from "@helios/shared";
import type {
  VerificationAction,
  VerificationFactType,
  VerificationStatus,
} from "@prisma/client";
import type { VerificationRepository } from "../repositories/verification-repository.js";
import { DoctorProofService } from "../security/doctor-proof.js";
import type { TimelineRebuildService } from "../timeline/timeline-rebuild-service.js";
import { AppError } from "../utils/app-error.js";
import type { DocumentStorage } from "../document-ai/storage.js";
import { serializeDocument } from "../serializers/document.js";
import type { ReviewableFact } from "./types.js";
import { securityEvent } from "../security/security-events.js";

export interface VerificationFilters {
  status?: ClinicalVerificationStatus;
  factType?: VerificationFactType;
  conflictsOnly?: boolean;
  search?: string;
  limit: number;
}

export interface VerificationActionInput {
  expectedVersion: number;
  idempotencyKey: string;
  reason?: string;
  comment?: string;
  correctedValue?: Record<string, unknown>;
}

export interface VerificationOperations {
  queue(
    patientId: string | undefined,
    filters: VerificationFilters,
    token?: string,
  ): Promise<VerificationQueueDto>;
  detail(
    reviewId: string,
    patientId: string | undefined,
    token?: string,
  ): Promise<VerificationReviewDto>;
  act(
    reviewId: string,
    action: VerificationAction,
    input: VerificationActionInput,
    token?: string,
    requestId?: string,
  ): Promise<VerificationActionResultDto>;
  history(
    patientId: string,
    limit: number,
    token?: string,
  ): Promise<VerificationHistoryDto[]>;
  bulkVerify(
    reviewIds: string[],
    expectedVersions: Record<string, number>,
    idempotencyKey: string,
    token?: string,
    requestId?: string,
  ): Promise<VerificationActionResultDto[]>;
  document(documentId: string, token?: string): Promise<MedicalDocumentDto>;
  documentContent(
    documentId: string,
    token?: string,
  ): Promise<{ buffer: Buffer; mimeType: string; fileName: string }>;
}

export class VerificationService implements VerificationOperations {
  constructor(
    private readonly repository: VerificationRepository,
    private readonly timeline: TimelineRebuildService,
    private readonly storage: DocumentStorage,
    private readonly proof = new DoctorProofService(),
  ) {}

  async queue(
    patientId: string | undefined,
    filters: VerificationFilters,
    token?: string,
  ) {
    const doctor = await this.authorize(token);
    if (patientId) await this.requireAssigned(doctor, patientId);
    const allowed = await this.repository.assignedPatientIds(
      doctor.id,
      doctor.role === "ADMIN",
    );
    const facts = await this.repository.listFacts(patientId, allowed);
    const decorated = await this.decorate(facts);
    const unresolved = decorated.filter((item) =>
      reviewable(item.fact.verificationStatus),
    );
    const filtered = unresolved
      .filter((item) => {
        if (
          filters.status &&
          normalizedStatus(item.fact.verificationStatus) !== filters.status
        )
          return false;
        if (filters.factType && item.fact.factType !== filters.factType)
          return false;
        if (filters.conflictsOnly && !item.conflict) return false;
        if (filters.search) {
          const needle = filters.search.toLowerCase();
          if (
            ![
              item.fact.patientName,
              item.fact.patientCode,
              item.fact.label,
              display(item.fact.value),
            ]
              .join(" ")
              .toLowerCase()
              .includes(needle)
          )
            return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          priority(a).value - priority(b).value ||
          a.fact.createdAt.getTime() - b.fact.createdAt.getTime() ||
          a.fact.factId.localeCompare(b.fact.factId),
      );
    const metrics = await this.repository.metrics(allowed);
    return {
      items: filtered
        .slice(0, filters.limit)
        .map((item) => queueDto(item.fact, item.conflict, item.safetyRelated)),
      metrics: {
        needsReview: unresolved.length,
        conflicts: decorated.filter(
          (item) => item.conflict && reviewable(item.fact.verificationStatus),
        ).length,
        ...metrics,
      },
    };
  }

  async detail(
    reviewId: string,
    patientId: string | undefined,
    token?: string,
  ) {
    const doctor = await this.authorize(token);
    const key = decodeReviewId(reviewId);
    const facts = await this.repository.listFacts(patientId);
    const fact = facts.find(
      (item) => item.factType === key.factType && item.factId === key.factId,
    );
    if (!fact)
      throw new AppError(
        "Verification item not found",
        404,
        "VERIFICATION_NOT_FOUND",
      );
    await this.requireAssigned(doctor, fact.patientId);
    return this.review(fact, facts);
  }

  async act(
    reviewId: string,
    action: VerificationAction,
    input: VerificationActionInput,
    token?: string,
    requestId?: string,
  ) {
    const doctor = await this.authorize(token);
    const replay = await this.repository.idempotent(input.idempotencyKey);
    const key = decodeReviewId(reviewId);
    if (replay) {
      await this.requireAssigned(doctor, replay.patientId);
      if (
        replay.factType !== key.factType ||
        replay.factId !== key.factId ||
        replay.action !== action
      )
        throw new AppError(
          "This idempotency key was already used for another action",
          409,
          "IDEMPOTENCY_KEY_REUSED",
        );
      const review = await this.detail(reviewId, replay.patientId, token);
      return resultDto(replay, review, false, true);
    }

    const facts = await this.repository.listFacts();
    const fact = facts.find(
      (item) => item.factType === key.factType && item.factId === key.factId,
    );
    if (!fact)
      throw new AppError(
        "Verification item not found",
        404,
        "VERIFICATION_NOT_FOUND",
      );
    await this.requireAssigned(doctor, fact.patientId);
    const context = await this.decorate(
      facts.filter((item) => item.patientId === fact.patientId),
    );
    const decorated = context.find(
      (item) =>
        item.fact.factType === fact.factType &&
        item.fact.factId === fact.factId,
    )!;
    validateTransition(fact.verificationStatus, action);
    validateAction(action, input, decorated.conflict, fact);
    const applied = await this.repository.apply(
      {
        patientId: fact.patientId,
        factType: fact.factType,
        factId: fact.factId,
        action,
        expectedVersion: input.expectedVersion,
        idempotencyKey: input.idempotencyKey,
        doctorId: doctor.id,
        ...(input.reason && { reason: input.reason }),
        ...(input.comment && { comment: input.comment }),
        ...(input.correctedValue && { correctedValue: input.correctedValue }),
        evidenceReferences: fact.evidence,
        ...(requestId && { requestId }),
      },
      fact,
    );
    let dependentRefreshPending = false;
    try {
      await this.timeline.rebuild(fact.patientId);
    } catch {
      dependentRefreshPending = true;
    }
    const review = await this.detail(reviewId, fact.patientId, token);
    return resultDto(
      applied.row,
      review,
      dependentRefreshPending,
      applied.replayed,
    );
  }

  async history(patientId: string, limit: number, token?: string) {
    const doctor = await this.authorize(token);
    await this.requireAssigned(doctor, patientId);
    const facts = await this.repository.listFacts(patientId);
    const keys = new Set(
      facts.map((fact) => `${fact.factType}:${fact.factId}`),
    );
    const rows = await Promise.all(
      facts.map((fact) => this.repository.history(fact.factType, fact.factId)),
    );
    return rows
      .flat()
      .filter((row) => keys.has(`${row.factType}:${row.factId}`))
      .sort((a, b) => b.verifiedAt.getTime() - a.verifiedAt.getTime())
      .slice(0, limit)
      .map(historyDto);
  }

  async bulkVerify(
    reviewIds: string[],
    expectedVersions: Record<string, number>,
    idempotencyKey: string,
    token?: string,
    requestId?: string,
  ) {
    await this.authorize(token);
    const results: VerificationActionResultDto[] = [];
    for (const [index, reviewId] of reviewIds.entries()) {
      const detail = await this.detail(reviewId, undefined, token);
      if (!detail.bulkEligible)
        throw new AppError(
          `${detail.label} requires individual review`,
          400,
          "BULK_VERIFICATION_NOT_ALLOWED",
        );
      const expectedVersion = expectedVersions[reviewId];
      if (expectedVersion === undefined)
        throw new AppError(
          "Every selected fact requires an expected version",
          400,
          "BULK_VERSION_REQUIRED",
        );
      results.push(
        await this.act(
          reviewId,
          "VERIFY",
          { expectedVersion, idempotencyKey: `${idempotencyKey}:${index}` },
          token,
          requestId,
        ),
      );
    }
    return results;
  }

  async document(documentId: string, token?: string) {
    const doctor = await this.authorize(token);
    const document = await this.repository.document(documentId);
    if (!document)
      throw new AppError("Document not found", 404, "DOCUMENT_NOT_FOUND");
    await this.requireAssigned(doctor, document.patientId);
    return serializeDocument(document);
  }

  async documentContent(documentId: string, token?: string) {
    const doctor = await this.authorize(token);
    const document = await this.repository.document(documentId);
    if (!document)
      throw new AppError("Document not found", 404, "DOCUMENT_NOT_FOUND");
    await this.requireAssigned(doctor, document.patientId);
    return {
      buffer: await this.storage.read(document.storagePath),
      mimeType: document.mimeType,
      fileName: document.fileName,
    };
  }

  private async review(fact: ReviewableFact, allFacts: ReviewableFact[]) {
    const [decorated] = await this.decorate([fact], allFacts);
    if (!decorated)
      throw new AppError(
        "Verification item not found",
        404,
        "VERIFICATION_NOT_FOUND",
      );
    const history = await this.repository.history(fact.factType, fact.factId);
    const dto = queueDto(fact, decorated.conflict, decorated.safetyRelated);
    return {
      ...dto,
      evidence: fact.evidence.map((item) => ({
        kind: item.kind,
        sourceId: item.sourceId,
        label: item.label,
        ...(item.sourceText && { sourceText: item.sourceText }),
        ...(item.language && { language: item.language }),
        ...(item.normalizedValue !== undefined && {
          normalizedValue: item.normalizedValue,
        }),
        ...(item.documentId && { documentId: item.documentId }),
        ...(item.documentName && { documentName: item.documentName }),
        ...(item.pageNumber !== undefined && { pageNumber: item.pageNumber }),
        ...(item.boundingBox !== undefined && {
          boundingBox: item.boundingBox,
        }),
        ...(item.occurredAt && { occurredAt: item.occurredAt.toISOString() }),
      })),
      ...(decorated.previous && {
        previous: {
          value: decorated.previous.value,
          sourceType: decorated.previous.sourceType,
          verificationStatus: normalizedStatus(
            decorated.previous.verificationStatus,
          ),
          recordedAt: decorated.previous.createdAt.toISOString(),
          label: decorated.previous.label,
        },
      }),
      history: history.map(historyDto),
      safetySignalCount: decorated.safetyRelated ? 1 : 0,
    } satisfies VerificationReviewDto;
  }

  private async decorate(facts: ReviewableFact[], comparisonPool = facts) {
    const patientIds = [...new Set(facts.map((fact) => fact.patientId))];
    const safetyVisits = new Set(
      await this.repository.riskVisitIds(patientIds),
    );
    return facts.map((fact) => {
      const previous = comparisonPool
        .filter(
          (candidate) =>
            candidate.patientId === fact.patientId &&
            candidate.factType === fact.factType &&
            candidate.factId !== fact.factId &&
            (candidate.normalizedKey === fact.normalizedKey ||
              sameAyushSystem(candidate, fact)) &&
            (fact.factType === "AYUSH_RECORD" ||
              [
                "DOCTOR_VERIFIED",
                "DOCTOR_CORRECTED",
                "VERIFIED",
                "EDITED",
              ].includes(candidate.verificationStatus)),
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      return {
        fact,
        previous,
        conflict: Boolean(
          previous && display(previous.value) !== display(fact.value),
        ),
        safetyRelated: Boolean(fact.visitId && safetyVisits.has(fact.visitId)),
      };
    });
  }

  private async authorize(token?: string) {
    const doctorId = this.proof.verify(token);
    const doctor = await this.repository.doctor(doctorId);
    if (!doctor)
      throw new AppError(
        "Doctor access is not authorized",
        403,
        "DOCTOR_NOT_AUTHORIZED",
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
        routeGroup: "verification",
      });
      throw new AppError(
        "Patient access is not authorized",
        403,
        "PATIENT_ACCESS_FORBIDDEN",
      );
    }
  }
}

function sameAyushSystem(left: ReviewableFact, right: ReviewableFact) {
  if (left.factType !== "AYUSH_RECORD" || right.factType !== "AYUSH_RECORD")
    return false;
  const leftValue = left.value as Record<string, unknown>;
  const rightValue = right.value as Record<string, unknown>;
  return (
    leftValue.system === rightValue.system &&
    leftValue.useStatus === "CURRENT" &&
    rightValue.useStatus === "CURRENT"
  );
}

function queueDto(
  fact: ReviewableFact,
  conflict: boolean,
  safetyRelated: boolean,
): VerificationQueueItemDto {
  return {
    reviewId: encodeReviewId(fact.factType, fact.factId),
    patientId: fact.patientId,
    patientName: fact.patientName,
    patientCode: fact.patientCode,
    ...(fact.visitId && { visitId: fact.visitId }),
    ...(fact.visitDate && { visitDate: fact.visitDate.toISOString() }),
    factType: fact.factType,
    factId: fact.factId,
    label: fact.label,
    value: fact.value,
    sourceType: fact.sourceType,
    verificationStatus: normalizedStatus(fact.verificationStatus),
    version: fact.version,
    workflowPriority: priority({ fact, conflict, safetyRelated }).value,
    conflict,
    bulkEligible:
      fact.factType === "DOCUMENT_FACT" &&
      !conflict &&
      (fact.confidence ?? 1) >= 0.8,
    evidenceAvailable: fact.evidence.length > 0,
  };
}

function priority(item: {
  fact: ReviewableFact;
  conflict: boolean;
  safetyRelated: boolean;
}) {
  return {
    value: item.safetyRelated
      ? 1
      : item.conflict
        ? 2
        : ["MEDICATION", "ALLERGY"].includes(item.fact.factType)
          ? 3
          : item.fact.factType === "DOCUMENT_FACT" &&
              (item.fact.confidence ?? 1) < 0.8
            ? 4
            : 5,
  };
}

function historyDto(row: {
  id: string;
  action: VerificationAction;
  previousStatus: VerificationStatus;
  newStatus: VerificationStatus;
  originalValue: unknown;
  verifiedValue: unknown;
  reason: string | null;
  comment: string | null;
  verifiedAt: Date;
  factVersion: number;
  verifier: { displayName: string };
}): VerificationHistoryDto {
  return {
    id: row.id,
    action: row.action,
    previousStatus: row.previousStatus,
    newStatus: row.newStatus,
    originalValue: row.originalValue,
    verifiedValue: row.verifiedValue,
    ...(row.reason && { reason: row.reason }),
    ...(row.comment && { comment: row.comment }),
    doctorName: row.verifier.displayName,
    verifiedAt: row.verifiedAt.toISOString(),
    factVersion: row.factVersion,
  };
}

function resultDto(
  row: Parameters<typeof historyDto>[0],
  review: VerificationReviewDto,
  dependentRefreshPending: boolean,
  replayed: boolean,
): VerificationActionResultDto {
  return {
    verification: historyDto(row),
    review,
    dependentRefreshPending,
    message: replayed
      ? "This verification action was already saved."
      : dependentRefreshPending
        ? "Verification saved. Some related views may need refresh."
        : "Verification saved and related views were refreshed.",
  };
}

function validateTransition(
  status: VerificationStatus,
  action: VerificationAction,
) {
  if (["DOCTOR_REJECTED", "SUPERSEDED", "REJECTED"].includes(status))
    throw new AppError(
      "This verification state cannot accept that action",
      409,
      "VERIFICATION_TRANSITION_INVALID",
    );
  if (
    ["DOCTOR_VERIFIED", "DOCTOR_CORRECTED", "VERIFIED", "EDITED"].includes(
      status,
    ) &&
    ["VERIFY", "CONFIRM_CURRENT"].includes(action)
  )
    throw new AppError(
      "This information is already doctor verified",
      409,
      "VERIFICATION_ALREADY_VERIFIED",
    );
}

function validateAction(
  action: VerificationAction,
  input: VerificationActionInput,
  conflict: boolean,
  fact: ReviewableFact,
) {
  if (
    action === "CORRECT" &&
    (!input.correctedValue || Object.keys(input.correctedValue).length === 0)
  )
    throw new AppError(
      "A structured corrected value is required",
      400,
      "CORRECTED_VALUE_REQUIRED",
    );
  if (action === "CORRECT" && fact.factType === "AYUSH_RECORD")
    validateAyushCorrection(input.correctedValue!);
  if (
    ["CORRECT", "REJECT", "KEEP_PREVIOUS", "CONFIRM_CURRENT"].includes(
      action,
    ) &&
    !input.reason?.trim()
  )
    throw new AppError(
      "A reason is required for this action",
      400,
      "VERIFICATION_REASON_REQUIRED",
    );
  if (["KEEP_PREVIOUS", "CONFIRM_CURRENT"].includes(action) && !conflict)
    throw new AppError(
      "Conflict resolution is available only for conflicting facts",
      409,
      "VERIFICATION_CONFLICT_REQUIRED",
    );
  if (conflict && action === "VERIFY")
    throw new AppError(
      "Choose an explicit conflict resolution action",
      409,
      "VERIFICATION_CONFLICT_DECISION_REQUIRED",
    );
  if (!fact.evidence.length)
    throw new AppError(
      "Evidence is unavailable for this information",
      409,
      "VERIFICATION_EVIDENCE_UNAVAILABLE",
    );
}

function validateAyushCorrection(value: Record<string, unknown>) {
  const allowed = new Set([
    "system",
    "useStatus",
    "practitionerName",
    "practitionerRegistrationId",
    "facilityName",
    "treatmentName",
    "medicineName",
    "normalizedName",
    "ingredients",
    "dosage",
    "frequency",
    "route",
    "startDate",
    "endDate",
    "indicationAsReported",
    "patientReportedReason",
    "reportedEffect",
    "notes",
  ]);
  if (Object.keys(value).some((key) => !allowed.has(key)))
    throw new AppError(
      "The AYUSH correction contains an unsupported field",
      400,
      "AYUSH_CORRECTION_FIELD_INVALID",
    );
  const systems = [
    "AYURVEDA",
    "YOGA_NATUROPATHY",
    "UNANI",
    "SIDDHA",
    "HOMOEOPATHY",
    "OTHER_TRADITIONAL_SYSTEM",
    "UNKNOWN",
  ];
  const states = [
    "CURRENT",
    "HISTORICAL",
    "STOPPED",
    "UNKNOWN",
    "NOT_DOCUMENTED",
  ];
  if (
    value.system !== undefined &&
    (typeof value.system !== "string" || !systems.includes(value.system))
  )
    throw new AppError("AYUSH system is invalid", 400, "AYUSH_SYSTEM_INVALID");
  if (
    value.useStatus !== undefined &&
    (typeof value.useStatus !== "string" || !states.includes(value.useStatus))
  )
    throw new AppError(
      "AYUSH use status is invalid",
      400,
      "AYUSH_USE_STATUS_INVALID",
    );
  for (const key of ["startDate", "endDate"])
    if (
      value[key] !== undefined &&
      (typeof value[key] !== "string" || Number.isNaN(Date.parse(value[key])))
    )
      throw new AppError(
        "AYUSH correction date is invalid",
        400,
        "AYUSH_DATE_INVALID",
      );
}

function reviewable(status: VerificationStatus) {
  return ![
    "DOCTOR_VERIFIED",
    "DOCTOR_CORRECTED",
    "DOCTOR_REJECTED",
    "SUPERSEDED",
    "VERIFIED",
    "EDITED",
    "REJECTED",
  ].includes(status);
}
function normalizedStatus(
  status: VerificationStatus,
): ClinicalVerificationStatus {
  if (status === "VERIFIED") return "DOCTOR_VERIFIED";
  if (status === "EDITED" || status === "PARTIALLY_CORRECT")
    return "DOCTOR_CORRECTED";
  if (status === "REJECTED") return "DOCTOR_REJECTED";
  if (status === "PENDING" || status === "MISSED") return "UNREVIEWED";
  return status;
}
function encodeReviewId(factType: VerificationFactType, factId: string) {
  return Buffer.from(`${factType}:${factId}`, "utf8").toString("base64url");
}
function decodeReviewId(reviewId: string) {
  try {
    const decoded = Buffer.from(reviewId, "base64url").toString("utf8");
    const separator = decoded.indexOf(":");
    const factType = decoded.slice(0, separator) as VerificationFactType;
    const factId = decoded.slice(separator + 1);
    if (
      !factId ||
      ![
        "CLINICAL_HISTORY",
        "SYMPTOM",
        "MEDICATION",
        "ALLERGY",
        "OBSERVATION",
        "DOCUMENT_FACT",
        "INTERVIEW_RESPONSE",
        "AYUSH_RECORD",
      ].includes(factType)
    )
      throw new Error("invalid");
    return { factType, factId };
  } catch {
    throw new AppError(
      "Verification item identifier is invalid",
      400,
      "VERIFICATION_ID_INVALID",
    );
  }
}
function display(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value);
}
