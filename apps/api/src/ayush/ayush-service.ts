import type { Prisma } from "@prisma/client";
import type { AyushPatientViewDto, AyushRecordDto } from "@helios/shared";
import type {
  AyushRepository,
  AyushRecordWithEvidence,
} from "../repositories/ayush-repository.js";
import type { TimelineRebuildService } from "../timeline/timeline-rebuild-service.js";
import type { DoctorProofService } from "../security/doctor-proof.js";
import type { SessionProofService } from "../security/session-proof.js";
import { AppError } from "../utils/app-error.js";
import { AyushNormalizer } from "./ayush-normalizer.js";
import { securityEvent } from "../security/security-events.js";

export interface AyushInput {
  visitId?: string | undefined;
  system?: string | undefined;
  useStatus?: string | undefined;
  practitionerName?: string | undefined;
  practitionerRegistrationId?: string | undefined;
  facilityName?: string | undefined;
  treatmentName?: string | undefined;
  medicineName?: string | undefined;
  originalName?: string | undefined;
  ingredients?: string[] | undefined;
  dosage?: string | undefined;
  frequency?: string | undefined;
  route?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  indicationAsReported?: string | undefined;
  patientReportedReason?: string | undefined;
  reportedEffect?: string | undefined;
  reportedEffectOnset?: string | undefined;
  originalStatement?: string | undefined;
  notes?: string | undefined;
  source?: "DOCTOR_ENTERED" | "AYUSH_PRACTITIONER_DOCUMENTED" | undefined;
}

export interface AyushOperations {
  patientView(
    patientId: string,
    sessionToken?: string,
  ): Promise<AyushPatientViewDto>;
  doctorView(
    patientId: string,
    doctorToken?: string,
  ): Promise<AyushPatientViewDto>;
  detail(recordId: string, doctorToken?: string): Promise<AyushRecordDto>;
  report(
    patientId: string,
    input: AyushInput,
    sessionToken?: string,
    requestId?: string,
  ): Promise<AyushRecordDto>;
  enter(
    patientId: string,
    input: AyushInput,
    doctorToken?: string,
    requestId?: string,
  ): Promise<AyushRecordDto>;
  projectDocument(documentId: string): Promise<void>;
  removeDocument(documentId: string): Promise<void>;
}

export class AyushService implements AyushOperations {
  constructor(
    private readonly repository: AyushRepository,
    private readonly timeline: TimelineRebuildService,
    private readonly patientProof: SessionProofService,
    private readonly doctorProof: DoctorProofService,
    private readonly normalizer = new AyushNormalizer(),
  ) {}

  async patientView(patientId: string, token?: string) {
    const sessionId = this.patientProof.verify(token);
    if (!(await this.repository.sessionOwns(patientId, sessionId)))
      this.patientDenied();
    return this.view(patientId);
  }

  async doctorView(patientId: string, token?: string) {
    const doctor = await this.doctor(token);
    await this.requireAssigned(doctor, patientId);
    return this.view(patientId);
  }

  async detail(recordId: string, token?: string) {
    const doctor = await this.doctor(token);
    const record = await this.repository.find(recordId);
    if (!record)
      throw new AppError(
        "AYUSH record not found",
        404,
        "AYUSH_RECORD_NOT_FOUND",
      );
    await this.requireAssigned(doctor, record.patientId);
    return serialize(record);
  }

  async report(
    patientId: string,
    input: AyushInput,
    token?: string,
    requestId?: string,
  ) {
    const sessionId = this.patientProof.verify(token);
    const session = await this.repository.sessionOwns(patientId, sessionId);
    if (!session) this.patientDenied();
    if (input.visitId && input.visitId !== session.visitId)
      this.patientDenied();
    const record = await this.repository.create(
      this.data(
        patientId,
        { ...input, visitId: input.visitId ?? session.visitId ?? undefined },
        "PATIENT_REPORTED",
      ),
      { action: "AYUSH_REPORTED", ...(requestId && { requestId }) },
    );
    await this.refresh(patientId);
    return serialize(record);
  }

  async enter(
    patientId: string,
    input: AyushInput,
    token?: string,
    requestId?: string,
  ) {
    const doctor = await this.doctor(token);
    await this.requireAssigned(doctor, patientId);
    const record = await this.repository.create(
      this.data(patientId, input, input.source ?? "DOCTOR_ENTERED"),
      {
        actorUserId: doctor.id,
        action: "AYUSH_ENTERED",
        ...(requestId && { requestId }),
      },
    );
    await this.refresh(patientId);
    return serialize(record);
  }

  async projectDocument(documentId: string) {
    const document = await this.repository.documentContext(documentId);
    if (!document) return;
    for (const fact of document.facts) {
      const value = object(fact.normalizedValue);
      const normalized = this.normalizer.normalize({
        system: string(value.system),
        useStatus: string(value.useStatus),
        originalName: string(
          value.originalName ?? value.medicineName ?? fact.originalValue,
        ),
        dosage: string(value.dosage),
        frequency: string(value.frequency),
        route: string(value.route),
      });
      const first = fact.evidence[0];
      const treatmentName = string(value.treatmentName);
      const medicineName = string(value.medicineName);
      const practitionerName = string(value.practitionerName);
      const facilityName = string(value.facilityName);
      const startDate = dateValue(value.startDate);
      const originalStatement = first?.sourceText ?? string(fact.originalValue);
      await this.repository.upsertDocument({
        patientId: document.patientId,
        ...(document.visitId && { visitId: document.visitId }),
        documentId: document.id,
        documentFactId: fact.id,
        ...normalized,
        ...(treatmentName && { treatmentName }),
        ...(medicineName && { medicineName }),
        ...(practitionerName && { practitionerName }),
        ...(facilityName && { facilityName }),
        ...(startDate && { startDate }),
        ...(originalStatement && { originalStatement }),
        source: "DOCUMENT_EXTRACTED",
        verificationStatus:
          fact.confidence !== null && fact.confidence < 0.7
            ? "NEEDS_REVIEW"
            : "DOCUMENT_EXTRACTED",
        evidenceReferences: evidenceJson(
          first && {
            kind: "DOCUMENT",
            sourceId: fact.id,
            label: document.fileName,
            sourceText: first.sourceText,
            documentId: document.id,
            documentName: document.fileName,
            pageNumber: first.pageNumber,
            boundingBox: first.boundingBox,
            occurredAt: fact.createdAt.toISOString(),
          },
        ),
      });
    }
    await this.repository.supersedeMissingDocumentRecords(
      documentId,
      document.facts.map((fact) => fact.id),
    );
    if (document.facts.length) await this.refresh(document.patientId);
  }

  async removeDocument(documentId: string) {
    const patientId = await this.repository.patientIdForDocument(documentId);
    await this.repository.supersedeMissingDocumentRecords(documentId, []);
    if (patientId) await this.refresh(patientId);
  }

  private async view(patientId: string): Promise<AyushPatientViewDto> {
    const result = await this.repository.patientView(patientId);
    if (!result)
      throw new AppError("Patient not found", 404, "PATIENT_NOT_FOUND");
    const records = result.ayushRecords.map(serialize);
    const medications = result.medications.map((item) => ({
      id: item.id,
      name: item.name,
      ...(item.dose && { dose: item.dose }),
      ...(item.frequency && { frequency: item.frequency }),
      verificationStatus: clinicalStatus(item.verificationStatus),
    }));
    const signals = result.visits
      .flatMap((visit) => visit.riskSignals)
      .filter((signal) =>
        /ayush|traditional|concurrent treatment/i.test(
          `${signal.category} ${signal.title} ${signal.description}`,
        ),
      )
      .map((signal) => ({
        id: signal.id,
        title: signal.title,
        status: signal.status,
        source: signal.source,
      }));
    return {
      patient: {
        id: result.id,
        fullName: result.fullName,
        patientCode: result.patientCode,
      },
      records,
      conventionalMedications: medications,
      existingSafetySignals: signals,
      concurrentUseIdentified:
        records.some((record) => record.useStatus === "CURRENT") &&
        medications.length > 0,
      interactionInformation: signals.length
        ? "VALIDATED_SIGNAL_AVAILABLE"
        : "UNAVAILABLE",
    };
  }

  private data(
    patientId: string,
    input: AyushInput,
    source:
      "PATIENT_REPORTED" | "DOCTOR_ENTERED" | "AYUSH_PRACTITIONER_DOCUMENTED",
  ): Prisma.AyushRecordUncheckedCreateInput {
    const originalName =
      input.originalName ?? input.medicineName ?? input.treatmentName;
    const normalized = this.normalizer.normalize({
      system: input.system,
      useStatus: input.useStatus,
      originalName,
      dosage: input.dosage,
      frequency: input.frequency,
      route: input.route,
    });
    return {
      patientId,
      ...(input.visitId && { visitId: input.visitId }),
      ...normalized,
      ...(input.practitionerName && {
        practitionerName: input.practitionerName,
      }),
      ...(input.practitionerRegistrationId && {
        practitionerRegistrationId: input.practitionerRegistrationId,
      }),
      ...(input.facilityName && { facilityName: input.facilityName }),
      ...(input.treatmentName && { treatmentName: input.treatmentName }),
      ...(input.medicineName && { medicineName: input.medicineName }),
      ...(input.ingredients && { ingredients: input.ingredients }),
      ...(input.startDate && { startDate: new Date(input.startDate) }),
      ...(input.endDate && { endDate: new Date(input.endDate) }),
      ...(input.indicationAsReported && {
        indicationAsReported: input.indicationAsReported,
      }),
      ...(input.patientReportedReason && {
        patientReportedReason: input.patientReportedReason,
      }),
      ...(input.reportedEffect && {
        reportedEffect: input.reportedEffect,
        temporalRelationship: "REPORTED_AFTER",
      }),
      ...(input.reportedEffectOnset && {
        reportedEffectOnset: new Date(input.reportedEffectOnset),
      }),
      ...(input.originalStatement && {
        originalStatement: input.originalStatement,
      }),
      source,
      verificationStatus: "NEEDS_REVIEW",
      evidenceReferences: evidenceJson({
        kind: "CLINICAL_RECORD",
        sourceId: input.visitId ?? patientId,
        label:
          source === "PATIENT_REPORTED"
            ? "Patient-reported AYUSH information"
            : "Doctor-entered AYUSH information",
        ...(input.originalStatement && { sourceText: input.originalStatement }),
        occurredAt: new Date().toISOString(),
      }),
      ...(input.notes && { notes: input.notes }),
    };
  }

  private async doctor(token?: string) {
    const doctor = await this.repository.activeDoctor(
      this.doctorProof.verify(token),
    );
    if (!doctor)
      throw new AppError(
        "Doctor access is not active",
        403,
        "DOCTOR_NOT_AUTHORIZED",
      );
    return doctor;
  }

  private async refresh(patientId: string) {
    try {
      await this.timeline.rebuild(patientId);
    } catch {
      /* source mutation remains committed */
    }
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
        routeGroup: "ayush",
      });
      throw new AppError(
        "Patient access is not authorized",
        403,
        "PATIENT_ACCESS_FORBIDDEN",
      );
    }
  }

  private patientDenied(): never {
    throw new AppError(
      "AYUSH records are not available for this session",
      403,
      "AYUSH_PATIENT_FORBIDDEN",
    );
  }
}

function serialize(record: AyushRecordWithEvidence): AyushRecordDto {
  return {
    id: record.id,
    patientId: record.patientId,
    ...(record.visitId && { visitId: record.visitId }),
    system: record.system,
    useStatus: record.useStatus,
    ...(record.practitionerName && {
      practitionerName: record.practitionerName,
    }),
    ...(record.practitionerRegistrationId && {
      practitionerRegistrationId: record.practitionerRegistrationId,
    }),
    ...(record.facilityName && { facilityName: record.facilityName }),
    ...(record.treatmentName && { treatmentName: record.treatmentName }),
    ...(record.medicineName && { medicineName: record.medicineName }),
    originalName: record.originalName,
    ...(record.normalizedName && { normalizedName: record.normalizedName }),
    ...(Array.isArray(record.ingredients) && {
      ingredients: record.ingredients.filter(
        (item): item is string => typeof item === "string",
      ),
    }),
    ...(record.dosage && { dosage: record.dosage }),
    ...(record.frequency && { frequency: record.frequency }),
    ...(record.route && { route: record.route }),
    ...(record.startDate && { startDate: record.startDate.toISOString() }),
    ...(record.endDate && { endDate: record.endDate.toISOString() }),
    ...(record.indicationAsReported && {
      indicationAsReported: record.indicationAsReported,
    }),
    ...(record.patientReportedReason && {
      patientReportedReason: record.patientReportedReason,
    }),
    ...(record.reportedEffect && { reportedEffect: record.reportedEffect }),
    ...(record.reportedEffectOnset && {
      reportedEffectOnset: record.reportedEffectOnset.toISOString(),
    }),
    ...(record.temporalRelationship && {
      temporalRelationship: record.temporalRelationship,
    }),
    ...(record.originalStatement && {
      originalStatement: record.originalStatement,
    }),
    sourceType: record.source as AyushRecordDto["sourceType"],
    verificationStatus: clinicalStatus(record.verificationStatus),
    verificationVersion: record.verificationVersion,
    evidence: evidence(record),
    ...(record.notes && { notes: record.notes }),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function evidence(record: AyushRecordWithEvidence): AyushRecordDto["evidence"] {
  if (record.document && record.documentFact?.evidence.length)
    return record.documentFact.evidence.map((item) => ({
      kind: "DOCUMENT",
      sourceId: record.documentFactId!,
      label: record.document!.fileName,
      sourceText: item.sourceText,
      documentId: record.document!.id,
      documentName: record.document!.fileName,
      pageNumber: item.pageNumber,
      ...(item.boundingBox && { boundingBox: item.boundingBox }),
      occurredAt: item.createdAt.toISOString(),
    }));
  if (record.interview)
    return record.interview.responses.map((item) => ({
      kind: "INTERVIEW",
      sourceId: item.id,
      label: item.questionId,
      sourceText: item.rawAnswer,
      language: item.language,
      ...(item.normalizedAnswer !== null && {
        normalizedValue: item.normalizedAnswer,
      }),
      occurredAt: item.createdAt.toISOString(),
    }));
  const parsed = Array.isArray(record.evidenceReferences)
    ? record.evidenceReferences
    : [];
  return parsed as unknown as AyushRecordDto["evidence"];
}

function clinicalStatus(status: string): AyushRecordDto["verificationStatus"] {
  if (status === "VERIFIED") return "DOCTOR_VERIFIED";
  if (["EDITED", "PARTIALLY_CORRECT"].includes(status))
    return "DOCTOR_CORRECTED";
  if (status === "REJECTED") return "DOCTOR_REJECTED";
  if (["PENDING", "MISSED"].includes(status)) return "UNREVIEWED";
  return status as AyushRecordDto["verificationStatus"];
}

function evidenceJson(value: unknown): Prisma.InputJsonValue {
  return value ? [value] : [];
}
function object(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}
function string(value: unknown) {
  return typeof value === "string" ? value : undefined;
}
function dateValue(value: unknown) {
  const text = string(value);
  return text && !Number.isNaN(Date.parse(text)) ? new Date(text) : undefined;
}
