import { createHash } from "node:crypto";
import type {
  BriefClaimDto,
  BriefEvidenceReferenceDto,
  BriefSectionDto,
  ClinicalBriefDto,
  ClinicalBriefListItemDto,
} from "@helios/shared";
import type { Prisma } from "@prisma/client";
import { briefConfig } from "./brief-config.js";
import {
  ClinicalBriefBuilder,
  CLINICAL_BRIEF_GENERATOR_VERSION,
} from "./clinical-brief-builder.js";
import type { BriefInput, BuiltBrief } from "./types.js";
import type {
  BriefRecord,
  ClinicalBriefRepository,
} from "../repositories/clinical-brief-repository.js";
import { DoctorProofService } from "../security/doctor-proof.js";
import { AppError } from "../utils/app-error.js";
import { securityEvent } from "../security/security-events.js";

export interface ClinicalBriefOperations {
  generate(
    patientId: string,
    visitId: string,
    token?: string,
    requestId?: string,
  ): Promise<ClinicalBriefDto>;
  quick(
    patientId: string,
    visitId: string | undefined,
    token?: string,
    requestId?: string,
  ): Promise<ClinicalBriefDto>;
  detail(
    id: string,
    token?: string,
    requestId?: string,
  ): Promise<ClinicalBriefDto>;
  list(
    patientId: string,
    limit: number,
    token?: string,
  ): Promise<ClinicalBriefListItemDto[]>;
  refresh(
    id: string,
    token?: string,
    requestId?: string,
  ): Promise<ClinicalBriefDto>;
  evidence(id: string, token?: string): Promise<BriefEvidenceReferenceDto[]>;
  claim(
    id: string,
    claimId: string,
    token?: string,
    requestId?: string,
  ): Promise<
    BriefClaimDto & {
      patientId: string;
      visitId: string;
      comparisonId?: string;
    }
  >;
  review(
    id: string,
    token?: string,
    requestId?: string,
  ): Promise<ClinicalBriefDto>;
  archive(
    id: string,
    token?: string,
    requestId?: string,
  ): Promise<ClinicalBriefDto>;
}

export class ClinicalBriefService implements ClinicalBriefOperations {
  constructor(
    private readonly repository: ClinicalBriefRepository,
    private readonly proof = new DoctorProofService(),
    private readonly builder = new ClinicalBriefBuilder(),
  ) {}

  async generate(
    patientId: string,
    visitId: string,
    token?: string,
    requestId?: string,
  ) {
    const doctor = await this.authorize(token);
    await this.requireAssigned(doctor, patientId);
    const source = await this.load(patientId, visitId);
    const built = this.builder.build(source);
    const sourceRevision = this.builder.revision(source);
    const cacheKey = hash({
      patientId,
      visitId,
      sourceRevision,
      generatorVersion: CLINICAL_BRIEF_GENERATOR_VERSION,
    });
    const cached = await this.repository.cached(cacheKey);
    if (cached) return serialize(cached);
    const previous = await this.repository.latest(patientId, visitId);
    const row = await this.repository.create(
      {
        patientId,
        visitId,
        ...(source.comparison && { comparisonId: source.comparison.id }),
        generatedAt: new Date(),
        generatorVersion: CLINICAL_BRIEF_GENERATOR_VERSION,
        sourceRevision,
        cacheKey,
        version: (previous?.version ?? 0) + 1,
        sections: {
          definitions: built.sections,
          narrative: built.narrative,
        } as unknown as Prisma.InputJsonValue,
        sourceReferences:
          built.sourceReferences as unknown as Prisma.InputJsonValue,
        createdBy: doctor.id,
        ...(previous && { previousVersionId: previous.id }),
      },
      persistenceClaims(built),
    );
    if (previous && previous.status !== "ARCHIVED")
      await this.repository.markStale(previous.id);
    await this.repository.audit(
      doctor.id,
      "CLINICAL_BRIEF_GENERATED",
      row.id,
      requestId,
      {
        patientId,
        visitId,
        version: row.version,
        claimCount: row.claims.length,
      },
    );
    return serialize(row);
  }

  async quick(
    patientId: string,
    visitId: string | undefined,
    token?: string,
    requestId?: string,
  ) {
    const doctor = await this.authorize(token);
    await this.requireAssigned(doctor, patientId);
    const selected =
      visitId ?? (await this.repository.latestVisit(patientId))?.id;
    if (!selected)
      throw new AppError(
        "No visit is available for this patient",
        404,
        "BRIEF_VISIT_NOT_FOUND",
      );
    const latest = await this.repository.latest(patientId, selected);
    return latest
      ? this.detail(latest.id, token, requestId)
      : this.generate(patientId, selected, token, requestId);
  }

  async detail(id: string, token?: string, requestId?: string) {
    const doctor = await this.authorize(token);
    let row = await this.repository.detail(id);
    if (!row)
      throw new AppError(
        "Clinical brief not found",
        404,
        "CLINICAL_BRIEF_NOT_FOUND",
      );
    await this.requireAssigned(doctor, row.patientId);
    const current = await this.load(row.patientId, row.visitId);
    if (
      this.builder.revision(current) !== row.sourceRevision &&
      row.status !== "ARCHIVED"
    )
      row = await this.repository.markStale(row.id);
    await this.repository.audit(
      doctor.id,
      "CLINICAL_BRIEF_VIEWED",
      row.id,
      requestId,
    );
    return serialize(row);
  }

  async list(patientId: string, limit: number, token?: string) {
    const doctor = await this.authorize(token);
    await this.requireAssigned(doctor, patientId);
    return (await this.repository.list(patientId, limit)).map(listItem);
  }

  async refresh(id: string, token?: string, requestId?: string) {
    const doctor = await this.authorize(token);
    const row = await this.repository.detail(id);
    if (!row)
      throw new AppError(
        "Clinical brief not found",
        404,
        "CLINICAL_BRIEF_NOT_FOUND",
      );
    await this.requireAssigned(doctor, row.patientId);
    const refreshed = await this.generate(
      row.patientId,
      row.visitId,
      token,
      requestId,
    );
    await this.repository.audit(
      doctor.id,
      "CLINICAL_BRIEF_REFRESHED",
      refreshed.id,
      requestId,
      { priorBriefId: id },
    );
    return refreshed;
  }

  async evidence(id: string, token?: string) {
    const detail = await this.detail(id, token);
    return unique(
      detail.sections.flatMap((section) =>
        section.claims.flatMap((claim) => claim.evidence),
      ),
    );
  }

  async claim(id: string, claimId: string, token?: string, requestId?: string) {
    const doctor = await this.authorize(token);
    const row = await this.repository.claim(id, claimId);
    if (!row)
      throw new AppError("Brief claim not found", 404, "BRIEF_CLAIM_NOT_FOUND");
    await this.requireAssigned(doctor, row.brief.patientId);
    await this.repository.audit(
      doctor.id,
      "BRIEF_CLAIM_EVIDENCE_OPENED",
      id,
      requestId,
      { claimId },
    );
    return {
      ...serializeClaim(row),
      patientId: row.brief.patientId,
      visitId: row.brief.visitId,
      ...(row.brief.comparisonId && { comparisonId: row.brief.comparisonId }),
    };
  }

  async review(id: string, token?: string, requestId?: string) {
    return this.changeStatus(
      id,
      "REVIEWED",
      "CLINICAL_BRIEF_REVIEWED",
      token,
      requestId,
    );
  }
  async archive(id: string, token?: string, requestId?: string) {
    return this.changeStatus(
      id,
      "ARCHIVED",
      "CLINICAL_BRIEF_ARCHIVED",
      token,
      requestId,
    );
  }

  private async changeStatus(
    id: string,
    status: "REVIEWED" | "ARCHIVED",
    action: string,
    token?: string,
    requestId?: string,
  ) {
    const doctor = await this.authorize(token);
    const existing = await this.repository.detail(id);
    if (!existing)
      throw new AppError(
        "Clinical brief not found",
        404,
        "CLINICAL_BRIEF_NOT_FOUND",
      );
    await this.requireAssigned(doctor, existing.patientId);
    const row = await this.repository.status(id, status);
    await this.repository.audit(doctor.id, action, id, requestId);
    return serialize(row);
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
        routeGroup: "clinical-brief",
      });
      throw new AppError(
        "Patient access is not authorized",
        403,
        "PATIENT_ACCESS_FORBIDDEN",
      );
    }
  }

  private async load(patientId: string, visitId: string): Promise<BriefInput> {
    const from = new Date();
    from.setUTCMonth(from.getUTCMonth() - briefConfig.recentMonths);
    const row = await this.repository.source(patientId, visitId, from);
    if (!row)
      throw new AppError(
        "Patient visit not found",
        404,
        "BRIEF_VISIT_NOT_FOUND",
      );
    const activeSignals = row.visit.riskSignals.filter(
      (signal) => signal.category !== "FUTURE_DEMO_ONLY",
    );
    return {
      patient: row.patient,
      visit: {
        id: row.visit.id,
        startedAt: row.visit.startedAt,
        ...(row.visit.clinicalHistory && {
          clinicalHistory: {
            id: row.visit.clinicalHistory.id,
            ...(row.visit.clinicalHistory.chiefComplaint && {
              chiefComplaint: row.visit.clinicalHistory.chiefComplaint,
            }),
            ...(row.visit.clinicalHistory.duration !== null && {
              duration: row.visit.clinicalHistory.duration,
            }),
            ...(row.visit.clinicalHistory.location !== null && {
              location: row.visit.clinicalHistory.location,
            }),
            ...(row.visit.clinicalHistory.associatedSymptoms !== null && {
              associatedSymptoms: row.visit.clinicalHistory.associatedSymptoms,
            }),
            source: row.visit.clinicalHistory.source,
            verificationStatus: row.visit.clinicalHistory.verificationStatus,
          },
        }),
      },
      symptoms: row.visit.symptoms.map((item) => ({
        id: item.id,
        name: item.name,
        ...(item.severity && { severity: item.severity }),
        ...(item.duration !== null && { duration: item.duration }),
        ...(item.location !== null && { location: item.location }),
        ...(item.status && { status: item.status }),
        source: item.source,
        verificationStatus: item.verificationStatus,
      })),
      medications: row.patient.medications.map((item) => ({
        id: item.id,
        name: item.name,
        ...(item.dose && { dose: item.dose }),
        ...(item.frequency && { frequency: item.frequency }),
        ...(item.route && { route: item.route }),
        ...(item.visitId && { visitId: item.visitId }),
        source: item.source,
        verificationStatus: item.verificationStatus,
        ...(item.verifiedAt && { verifiedAt: item.verifiedAt }),
      })),
      allergies: row.patient.allergies.map((item) => ({
        id: item.id,
        allergen: item.allergen,
        ...(item.reaction && { reaction: item.reaction }),
        ...(item.severity && { severity: item.severity }),
        source: item.source,
        verificationStatus: item.verificationStatus,
        ...(item.verifiedAt && { verifiedAt: item.verifiedAt }),
      })),
      observations: row.patient.observations.map((item) => ({
        id: item.id,
        display: item.display,
        ...(item.value !== null && { value: item.value }),
        ...(item.unit && { unit: item.unit }),
        state: item.state,
        source: item.source,
        verificationStatus: item.verificationStatus,
        ...(item.effectiveAt && { effectiveAt: item.effectiveAt }),
      })),
      ayushRecords: (row.patient.ayushRecords ?? []).map((item) => ({
        id: item.id,
        system: item.system,
        useStatus: item.useStatus,
        originalName: item.originalName,
        ...(item.normalizedName && { normalizedName: item.normalizedName }),
        ...(item.dosage && { dosage: item.dosage }),
        ...(item.frequency && { frequency: item.frequency }),
        ...(item.route && { route: item.route }),
        ...(item.indicationAsReported && {
          indicationAsReported: item.indicationAsReported,
        }),
        ...(item.reportedEffect && { reportedEffect: item.reportedEffect }),
        ...(item.temporalRelationship && {
          temporalRelationship: item.temporalRelationship,
        }),
        ...(item.startDate && { startDate: item.startDate }),
        source: item.source,
        verificationStatus: item.verificationStatus,
      })),
      documents: row.patient.documents.map((document) => ({
        id: document.id,
        fileName: document.fileName,
        documentType: document.documentType,
        ...(document.documentDate && { documentDate: document.documentDate }),
        ...(document.summary && { summary: document.summary }),
        processingStatus: document.processingStatus,
        facts: document.facts.map((fact) => ({
          id: fact.id,
          factType: fact.factType,
          ...(fact.normalizedValue !== null && {
            normalizedValue: fact.normalizedValue,
          }),
          ...(fact.confidence !== null && { confidence: fact.confidence }),
          status: fact.status,
          verificationStatus: fact.verificationStatus,
          evidence: fact.evidence,
        })),
      })),
      history: row.history.map((item) => ({
        id: item.id,
        title: item.title,
        ...(item.description && { description: item.description }),
        ...(item.eventDate && { eventDate: item.eventDate }),
        source: item.source,
        verificationStatus: item.verificationStatus,
      })),
      ...(row.comparison && {
        comparison: {
          id: row.comparison.id,
          status: row.comparison.status,
          changes: row.comparison.changes.map((item) => ({
            id: item.id,
            entityType: item.entityType,
            entityKey: item.entityKey,
            changeType: item.changeType,
            fieldChanges: item.fieldChanges,
            ...(item.previousValue !== null && {
              previousValue: item.previousValue,
            }),
            ...(item.currentValue !== null && {
              currentValue: item.currentValue,
            }),
            ...(item.previousEvidence !== null && {
              previousEvidence: item.previousEvidence,
            }),
            ...(item.currentEvidence !== null && {
              currentEvidence: item.currentEvidence,
            }),
            needsReview: item.needsReview,
            explanation: item.explanation,
            ...(item.previousVerificationStatus && {
              previousVerificationStatus: item.previousVerificationStatus,
            }),
            ...(item.currentVerificationStatus && {
              currentVerificationStatus: item.currentVerificationStatus,
            }),
          })),
        },
      }),
      safetyAvailable: activeSignals.length > 0,
      riskSignals: activeSignals,
    };
  }
}

function persistenceClaims(
  built: BuiltBrief,
): Prisma.BriefClaimUncheckedCreateWithoutBriefInput[] {
  return built.claims.map((claim) => ({
    sectionType: claim.sectionType,
    position: claim.position,
    claimKey: claim.claimKey,
    text: claim.text,
    ...(claim.structuredValue !== undefined && {
      structuredValue: claim.structuredValue as Prisma.InputJsonValue,
    }),
    sourceType: claim.sourceType,
    sourceId: claim.sourceId,
    evidenceReferences: claim.evidence as unknown as Prisma.InputJsonValue,
    verificationStatus: claim.verificationStatus,
    ...(claim.confidence !== undefined && { confidence: claim.confidence }),
    needsVerification: claim.needsVerification,
  }));
}
function serialize(row: BriefRecord): ClinicalBriefDto {
  const stored = row.sections as unknown as {
    definitions: Array<Omit<BriefSectionDto, "claims">>;
    narrative: string;
  };
  return {
    id: row.id,
    patientId: row.patientId,
    patientName: row.patient.fullName,
    patientCode: row.patient.patientCode,
    age: row.patient.age,
    sex: row.patient.sex,
    preferredLanguage: row.patient.preferredLanguage,
    visitId: row.visitId,
    visitDate: row.visit.startedAt.toISOString(),
    ...(row.comparisonId && { comparisonId: row.comparisonId }),
    status: row.status,
    version: row.version,
    generatorVersion: row.generatorVersion,
    generatedAt: row.generatedAt.toISOString(),
    narrative: stored.narrative,
    sections: stored.definitions.map((section) => ({
      ...section,
      claims: row.claims
        .filter((claim) => claim.sectionType === section.sectionType)
        .map(serializeClaim),
    })),
    claimCount: row.claims.length,
  };
}
function serializeClaim(row: BriefRecord["claims"][number]): BriefClaimDto {
  const claim = row;
  return {
    id: claim.id,
    claimKey: claim.claimKey,
    sectionType: claim.sectionType,
    text: claim.text,
    ...(claim.structuredValue !== null && {
      structuredValue: claim.structuredValue,
    }),
    sourceType: claim.sourceType,
    sourceId: claim.sourceId,
    verificationStatus: claim.verificationStatus,
    confidenceBand:
      claim.confidence === null
        ? "UNKNOWN"
        : claim.confidence >= 0.85
          ? "HIGH"
          : claim.confidence >= 0.65
            ? "MEDIUM"
            : "LOW",
    needsVerification: claim.needsVerification,
    evidence:
      claim.evidenceReferences as unknown as BriefEvidenceReferenceDto[],
  };
}
function listItem(row: BriefRecord): ClinicalBriefListItemDto {
  return {
    id: row.id,
    patientId: row.patientId,
    visitId: row.visitId,
    visitDate: row.visit.startedAt.toISOString(),
    status: row.status,
    version: row.version,
    generatorVersion: row.generatorVersion,
    generatedAt: row.generatedAt.toISOString(),
    claimCount: row.claims.length,
  };
}
function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function unique(items: BriefEvidenceReferenceDto[]) {
  return [
    ...new Map(
      items.map((item) => [`${item.kind}:${item.sourceId}`, item]),
    ).values(),
  ];
}
