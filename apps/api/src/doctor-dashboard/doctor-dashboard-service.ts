import type {
  DoctorDashboardDto,
  DoctorNoteDto,
  DoctorPatientWorkspaceDto,
  DoctorQueueItemDto,
  DoctorQueueStatus,
} from "@helios/shared";
import type { UserRole, VisitStatus } from "@prisma/client";
import { env } from "../config/env.js";
import type { ClinicalBriefOperations } from "../clinical-brief/clinical-brief-service.js";
import type { ComparisonOperations } from "../comparison/comparison-service.js";
import type { DocumentRepository } from "../repositories/document-repository.js";
import type {
  DoctorDashboardRepository,
  DoctorQueueVisit,
} from "../repositories/doctor-dashboard-repository.js";
import type { TimelineRepository } from "../repositories/timeline-repository.js";
import { DoctorProofService } from "../security/doctor-proof.js";
import { serializeDocument } from "../serializers/document.js";
import { serializeTimelineEvent } from "../timeline/timeline-service.js";
import { AppError } from "../utils/app-error.js";
import type { VerificationOperations } from "../verification/verification-service.js";

export interface DoctorDashboardFilters {
  search?: string;
  status?: DoctorQueueStatus;
  sort: "time" | "priority" | "name";
  direction: "asc" | "desc";
  page: number;
  limit: number;
}

export interface DoctorDashboardOperations {
  dashboard(
    filters: DoctorDashboardFilters,
    token?: string,
  ): Promise<DoctorDashboardDto>;
  workspace(
    patientId: string,
    visitId: string | undefined,
    token?: string,
    requestId?: string,
  ): Promise<DoctorPatientWorkspaceDto>;
  notes(patientId: string, token?: string): Promise<DoctorNoteDto[]>;
  createNote(
    patientId: string,
    input: { visitId?: string; content: string },
    token?: string,
    requestId?: string,
  ): Promise<DoctorNoteDto>;
  updateNote(
    patientId: string,
    noteId: string,
    content: string,
    token?: string,
    requestId?: string,
  ): Promise<DoctorNoteDto>;
  transitionVisit(
    visitId: string,
    status: VisitStatus,
    token?: string,
    requestId?: string,
  ): Promise<{
    visitId: string;
    patientId: string;
    previousStatus: VisitStatus;
    status: VisitStatus;
    completedAt?: string;
  }>;
}

type Doctor = {
  id: string;
  displayName: string;
  role: UserRole;
  preferredLanguage: string;
};

export class DoctorDashboardService implements DoctorDashboardOperations {
  constructor(
    private readonly repository: DoctorDashboardRepository,
    private readonly briefs: ClinicalBriefOperations,
    private readonly comparisons: ComparisonOperations,
    private readonly verification: VerificationOperations,
    private readonly documents: DocumentRepository,
    private readonly timeline: TimelineRepository,
    private readonly proof = new DoctorProofService(),
  ) {}

  async dashboard(filters: DoctorDashboardFilters, token?: string) {
    const doctor = await this.authorize(token);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    let rows = await this.repository.queueVisits(
      start,
      false,
      doctor.id,
      doctor.role === "ADMIN",
    );
    let queueScope: DoctorDashboardDto["queueScope"] = "TODAY";
    if (!rows.length && env.DEMO_MODE) {
      rows = await this.repository.queueVisits(
        start,
        true,
        doctor.id,
        doctor.role === "ADMIN",
      );
      queueScope = "RECENT_ACTIVE_DEMO_FALLBACK";
    }
    const decorated = rows.map((row) => ({
      item: queueItem(row),
      searchText: [
        row.patient.fullName,
        row.patient.patientCode,
        row.patient.phone,
        row.clinicalHistory?.chiefComplaint,
        ...row.symptoms.map((symptom) => symptom.name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase(),
    }));
    const all = decorated.map(({ item }) => item);
    const needle = filters.search?.toLocaleLowerCase();
    const filtered = decorated
      .filter(({ item, searchText }) => {
        if (filters.status && item.status !== filters.status) return false;
        return !needle || searchText.includes(needle);
      })
      .map(({ item }) => item);
    filtered.sort(queueSorter(filters.sort, filters.direction));
    const offset = (filters.page - 1) * filters.limit;
    const totalPages = Math.max(1, Math.ceil(filtered.length / filters.limit));
    return {
      doctor: {
        id: doctor.id,
        displayName: doctor.displayName,
        role: doctor.role as "DOCTOR" | "ADMIN",
        preferredLanguage: doctor.preferredLanguage,
      },
      metrics: {
        patientsToday: new Set(all.map((item) => item.patientId)).size,
        waiting: all.filter((item) => item.status === "WAITING").length,
        pendingVerification: all.reduce(
          (sum, item) => sum + item.pendingVerificationCount,
          0,
        ),
        highPriority: all.filter((item) => item.priority === "HIGH").length,
        verifiedOrCompleted: all.filter((item) =>
          ["VERIFIED", "COMPLETED"].includes(item.status),
        ).length,
      },
      queue: filtered.slice(offset, offset + filters.limit),
      notifications: notifications(all),
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: filtered.length,
        totalPages,
      },
      queueScope,
      demoMode: env.DEMO_MODE,
    } satisfies DoctorDashboardDto;
  }

  async workspace(
    patientId: string,
    visitId: string | undefined,
    token?: string,
    requestId?: string,
  ) {
    const doctor = await this.authorize(token);
    await this.requireAssigned(doctor, patientId);
    const [patient, visit] = await Promise.all([
      this.repository.patient(patientId),
      this.repository.visit(patientId, visitId),
    ]);
    if (!patient)
      throw new AppError("Patient not found", 404, "PATIENT_NOT_FOUND");
    if (!visit)
      throw new AppError(
        "Visit not found for this patient",
        404,
        "VISIT_NOT_FOUND",
      );
    await this.repository.audit(
      doctor.id,
      "DOCTOR_PATIENT_OPENED",
      "PatientProfile",
      patientId,
      requestId,
      { visitId: visit.id },
    );
    const [
      clinicalBrief,
      comparison,
      documents,
      timeline,
      verificationHistory,
      notes,
    ] = await Promise.all([
      optional(() => this.briefs.quick(patientId, visit.id, token, requestId)),
      optional(() => this.comparisons.quick(patientId, token, requestId)),
      this.documents.listForDoctor(patientId, 20),
      this.timeline.listForDoctor(patientId, 75),
      this.verification.history(patientId, 50, token),
      this.repository.notes(patientId),
    ]);
    const interviewState = object(visit.interview?.state);
    const unresolved = pendingCount(visit);
    return {
      doctor: {
        id: doctor.id,
        displayName: doctor.displayName,
        role: doctor.role as "DOCTOR" | "ADMIN",
      },
      patient: {
        id: patient.id,
        patientCode: patient.patientCode,
        fullName: patient.fullName,
        age: patient.age,
        sex: patient.sex,
        ...(patient.phone && { phone: patient.phone }),
        preferredLanguage: patient.preferredLanguage,
      },
      visit: {
        id: visit.id,
        status: visit.status,
        visitType: visit.visitType,
        ...(visit.tokenNumber && { tokenNumber: visit.tokenNumber }),
        startedAt: visit.startedAt.toISOString(),
        ...(visit.completedAt && {
          completedAt: visit.completedAt.toISOString(),
        }),
        ...(visit.clinicalHistory?.chiefComplaint && {
          chiefComplaint: visit.clinicalHistory.chiefComplaint,
        }),
      },
      ...(clinicalBrief && { clinicalBrief }),
      ...(comparison && { comparison }),
      safetySignals: visit.riskSignals
        .filter((signal) => signal.category !== "FUTURE_DEMO_ONLY")
        .map((signal) => ({
          id: signal.id,
          category: signal.category,
          severity: signal.severity,
          title: signal.title,
          description: signal.description,
          source: signal.source,
          status: signal.status,
          createdAt: signal.createdAt.toISOString(),
          ...(signal.resolvedAt && {
            resolvedAt: signal.resolvedAt.toISOString(),
          }),
          reviewMessage: "Requires clinical review." as const,
        })),
      documents: documents.map(serializeDocument),
      timeline: timeline.map((event) =>
        serializeTimelineEvent(event, Boolean(event.conflictKey)),
      ),
      verificationHistory,
      notes: notes.map((note) => noteDto(note, doctor)),
      aiInsights: {
        label: "AI-STRUCTURED",
        requiresVerification: true,
        missingInformation: strings(interviewState.unknownFields),
        contradictions: strings(interviewState.conflicts),
        pendingVerificationCount: unresolved,
        structuredFactCount:
          visit.interview?.responses.filter(
            (response) => response.normalizedAnswer !== null,
          ).length ?? 0,
      },
      capabilities: {
        safetyEngineAvailable: false,
        requestInformationAvailable: false,
      },
    } satisfies DoctorPatientWorkspaceDto;
  }

  async notes(patientId: string, token?: string) {
    const doctor = await this.authorize(token);
    await this.requireAssigned(doctor, patientId);
    if (!(await this.repository.patient(patientId)))
      throw new AppError("Patient not found", 404, "PATIENT_NOT_FOUND");
    return (await this.repository.notes(patientId)).map((note) =>
      noteDto(note, doctor),
    );
  }

  async createNote(
    patientId: string,
    input: { visitId?: string; content: string },
    token?: string,
    requestId?: string,
  ) {
    const doctor = await this.authorize(token);
    await this.requireAssigned(doctor, patientId);
    if (!(await this.repository.patient(patientId)))
      throw new AppError("Patient not found", 404, "PATIENT_NOT_FOUND");
    if (
      input.visitId &&
      !(await this.repository.visit(patientId, input.visitId))
    )
      throw new AppError(
        "Visit not found for this patient",
        404,
        "VISIT_NOT_FOUND",
      );
    return noteDto(
      await this.repository.createNote(
        patientId,
        input.visitId,
        doctor.id,
        input.content,
        requestId,
      ),
      doctor,
    );
  }

  async updateNote(
    patientId: string,
    noteId: string,
    content: string,
    token?: string,
    requestId?: string,
  ) {
    const doctor = await this.authorize(token);
    await this.requireAssigned(doctor, patientId);
    const updated = await this.repository.updateNote(
      noteId,
      patientId,
      doctor.id,
      doctor.role === "ADMIN",
      content,
      requestId,
    );
    if (!updated || updated.patientId !== patientId)
      throw new AppError(
        "This note cannot be edited",
        403,
        "DOCTOR_NOTE_FORBIDDEN",
      );
    return noteDto(updated, doctor);
  }

  async transitionVisit(
    visitId: string,
    status: VisitStatus,
    token?: string,
    requestId?: string,
  ) {
    const doctor = await this.authorize(token);
    const current = await this.repository.visitStatus(visitId);
    if (!current) throw new AppError("Visit not found", 404, "VISIT_NOT_FOUND");
    await this.requireAssigned(doctor, current.patientId);
    if (!allowedTransitions[current.status].includes(status))
      throw new AppError(
        `Visit cannot move from ${current.status} to ${status}`,
        409,
        "VISIT_TRANSITION_INVALID",
      );
    const result = await this.repository.transitionVisit(
      visitId,
      current.status,
      status,
      doctor.id,
      requestId,
    );
    if (!result)
      throw new AppError(
        "Visit changed during this action. Refresh and try again.",
        409,
        "VISIT_STATUS_CONFLICT",
      );
    return {
      visitId: result.visit.id,
      patientId: result.visit.patientId,
      previousStatus: result.previousStatus,
      status: result.visit.status,
      ...(result.visit.completedAt && {
        completedAt: result.visit.completedAt.toISOString(),
      }),
    };
  }

  private async authorize(token?: string) {
    const id = this.proof.verify(token);
    const doctor = await this.repository.doctor(id);
    if (!doctor)
      throw new AppError(
        "Doctor access is not authorized",
        403,
        "DOCTOR_NOT_AUTHORIZED",
      );
    return doctor;
  }

  private async requireAssigned(doctor: Doctor, patientId: string) {
    if (
      !(await this.repository.assigned(
        doctor.id,
        patientId,
        doctor.role === "ADMIN",
      ))
    )
      throw new AppError(
        "Patient access is not authorized",
        403,
        "DOCTOR_PATIENT_FORBIDDEN",
      );
  }
}

function queueItem(row: DoctorQueueVisit): DoctorQueueItemDto {
  const pendingVerificationCount = pendingCount(row);
  const openDocumentCount = row.documents.filter(
    (document) => document.processingStatus !== "VERIFIED",
  ).length;
  const openSafetySignalCount = row.riskSignals.length;
  const high = row.riskSignals.some((signal) => signal.severity === "HIGH");
  const status: DoctorQueueStatus =
    row.status === "COMPLETED"
      ? "COMPLETED"
      : high
        ? "HIGH_PRIORITY_REVIEW"
        : pendingVerificationCount > 0
          ? "NEEDS_REVIEW"
          : row.status === "VERIFIED"
            ? "VERIFIED"
            : ["IN_PROGRESS", "UNDER_REVIEW"].includes(row.status)
              ? "IN_PROGRESS"
              : "WAITING";
  return {
    patientId: row.patient.id,
    patientCode: row.patient.patientCode,
    fullName: row.patient.fullName,
    age: row.patient.age,
    sex: row.patient.sex,
    ...(row.patient.phone && { phone: row.patient.phone }),
    preferredLanguage: row.patient.preferredLanguage,
    visitId: row.id,
    visitDate: row.startedAt.toISOString(),
    appointmentLabel:
      row.visitType === "FOLLOW_UP" ? "Follow-up" : "Pre-consultation",
    ...(row.tokenNumber && { tokenNumber: row.tokenNumber }),
    ...(row.clinicalHistory?.chiefComplaint && {
      chiefComplaint: row.clinicalHistory.chiefComplaint,
    }),
    status,
    visitStatus: row.status,
    priority:
      row.status === "COMPLETED"
        ? "ROUTINE"
        : high
          ? "HIGH"
          : pendingVerificationCount > 0 || openDocumentCount > 0
            ? "ATTENTION"
            : "ROUTINE",
    pendingVerificationCount,
    openDocumentCount,
    openSafetySignalCount,
  };
}

function pendingCount(
  row: Pick<
    DoctorQueueVisit,
    | "clinicalHistory"
    | "symptoms"
    | "medications"
    | "allergies"
    | "observations"
    | "documentFacts"
    | "ayushRecords"
  >,
) {
  const pending = new Set([
    "PENDING",
    "MISSED",
    "UNREVIEWED",
    "PATIENT_REPORTED",
    "AI_STRUCTURED",
    "DOCUMENT_EXTRACTED",
    "NEEDS_REVIEW",
  ]);
  return [
    row.clinicalHistory,
    ...row.symptoms,
    ...row.medications,
    ...row.allergies,
    ...row.observations,
    ...row.documentFacts.filter((fact) => fact.status !== "REJECTED"),
    ...row.ayushRecords,
  ]
    .filter(Boolean)
    .filter((fact) => pending.has(fact!.verificationStatus)).length;
}

function notifications(queue: DoctorQueueItemDto[]) {
  return queue
    .flatMap((item) => {
      const createdAt = item.visitDate;
      const base = {
        patientId: item.patientId,
        visitId: item.visitId,
        createdAt,
      };
      return [
        ...(item.priority === "HIGH"
          ? [
              {
                ...base,
                id: `safety-${item.visitId}`,
                kind: "SAFETY_ATTENTION" as const,
                title: "Safety attention",
                summary: `${item.patientCode} has a stored signal requiring clinical review.`,
                priority: "HIGH" as const,
              },
            ]
          : []),
        ...(item.pendingVerificationCount
          ? [
              {
                ...base,
                id: `verify-${item.visitId}`,
                kind: "VERIFICATION_REQUIRED" as const,
                title: "Verification required",
                summary: `${item.patientCode} has ${item.pendingVerificationCount} item(s) awaiting review.`,
                priority: "NORMAL" as const,
              },
            ]
          : []),
        ...(item.openDocumentCount
          ? [
              {
                ...base,
                id: `document-${item.visitId}`,
                kind: "DOCUMENT_REVIEW" as const,
                title: "Document review",
                summary: `${item.patientCode} has ${item.openDocumentCount} open document(s).`,
                priority: "NORMAL" as const,
              },
            ]
          : []),
      ];
    })
    .sort((a, b) =>
      a.priority === b.priority
        ? b.createdAt.localeCompare(a.createdAt)
        : a.priority === "HIGH"
          ? -1
          : 1,
    )
    .slice(0, 12);
}

function queueSorter(
  sort: DoctorDashboardFilters["sort"],
  direction: DoctorDashboardFilters["direction"],
) {
  const sign = direction === "asc" ? 1 : -1;
  const rank = { HIGH: 0, ATTENTION: 1, ROUTINE: 2 };
  return (a: DoctorQueueItemDto, b: DoctorQueueItemDto) =>
    sign *
    (sort === "name"
      ? a.fullName.localeCompare(b.fullName)
      : sort === "priority"
        ? rank[a.priority] - rank[b.priority] ||
          a.visitDate.localeCompare(b.visitDate)
        : a.visitDate.localeCompare(b.visitDate));
}

function noteDto(
  note: Awaited<ReturnType<DoctorDashboardRepository["notes"]>>[number],
  doctor: Doctor,
): DoctorNoteDto {
  return {
    id: note.id,
    patientId: note.patientId,
    ...(note.visitId && { visitId: note.visitId }),
    content: note.content,
    author: note.author,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    editable: doctor.role === "ADMIN" || note.authorId === doctor.id,
  };
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function strings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
async function optional<T>(work: () => Promise<T>): Promise<T | undefined> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof AppError && [404, 409].includes(error.statusCode))
      return undefined;
    throw error;
  }
}

const allowedTransitions: Record<VisitStatus, VisitStatus[]> = {
  WAITING: ["IN_PROGRESS"],
  IN_PROGRESS: ["UNDER_REVIEW", "COMPLETED"],
  READY_FOR_DOCTOR: ["IN_PROGRESS", "UNDER_REVIEW"],
  UNDER_REVIEW: ["VERIFIED", "COMPLETED"],
  VERIFIED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};
