import type {
  ClinicalSource,
  DocumentFactStatus,
  DocumentType,
  RiskSeverity,
  TimelineEventStatus,
  TimelineEventType,
  TimelineMedicationAction,
  TimelineSource,
  TimelineTemporalState,
  VerificationStatus,
  VisitStatus,
} from "@prisma/client";
import { TimelineNormalizer } from "./timeline-normalizer.js";
import type { ProjectedTimelineEvent } from "./types.js";

interface BaseEvent {
  patientId: string;
  visitId?: string;
  documentId?: string;
  documentFactId?: string;
  eventType: TimelineEventType;
  title: string;
  description?: string;
  eventDate?: Date | null;
  eventEndDate?: Date;
  datePrecision?:
    "EXACT_DATE" | "MONTH_ONLY" | "YEAR_ONLY" | "DATE_RANGE" | "UNKNOWN";
  source: TimelineSource;
  sourceType: string;
  sourceId: string;
  sourceText?: string;
  temporalText?: string;
  pageNumber?: number;
  verificationStatus: TimelineEventStatus;
  temporalState?: TimelineTemporalState;
  medicationAction?: TimelineMedicationAction;
  confidence?: number | null;
  originalValue?: unknown;
  normalizedValue?: unknown;
  groupKey?: string;
  normalizedKey?: string;
  recordedAt: Date;
}

export class TimelineEventBuilder {
  constructor(private readonly normalizer = new TimelineNormalizer()) {}

  build(input: BaseEvent): ProjectedTimelineEvent {
    const normalizedKey =
      input.normalizedKey ?? this.normalizer.key(input.title);
    const fingerprint = this.normalizer.fingerprint({
      patientId: input.patientId,
      eventType: input.eventType,
      source: input.source,
      sourceId: input.sourceId,
      normalizedKey,
    });
    const date = input.datePrecision
      ? {
          ...(input.eventDate && { eventDate: input.eventDate }),
          datePrecision: input.datePrecision,
        }
      : this.normalizer.date(input.eventDate);
    const conflictKey = conflictable(input.eventType)
      ? [
          input.patientId,
          input.eventType,
          normalizedKey,
          ...(["LAB_RESULT", "OBSERVATION"].includes(input.eventType)
            ? [input.eventDate?.toISOString() ?? "unknown-date"]
            : []),
        ].join(":")
      : undefined;
    return {
      patientId: input.patientId,
      ...(input.visitId && { visitId: input.visitId }),
      ...(input.documentId && { documentId: input.documentId }),
      ...(input.documentFactId && { documentFactId: input.documentFactId }),
      eventType: input.eventType,
      title: input.title,
      ...(input.description && { description: input.description }),
      ...date,
      ...(input.eventEndDate && { eventEndDate: input.eventEndDate }),
      temporalState: input.temporalState ?? "UNKNOWN",
      ...(input.medicationAction && {
        medicationAction: input.medicationAction,
      }),
      source: input.source,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      ...(input.sourceText && { sourceText: input.sourceText }),
      ...(input.temporalText && { temporalText: input.temporalText }),
      ...(input.pageNumber !== undefined && { pageNumber: input.pageNumber }),
      verificationStatus: input.verificationStatus,
      ...(input.confidence !== null &&
        input.confidence !== undefined && {
          confidence: input.confidence,
        }),
      ...(input.originalValue !== undefined && {
        originalValue: input.originalValue,
      }),
      ...(input.normalizedValue !== undefined && {
        normalizedValue: input.normalizedValue,
      }),
      ...(input.groupKey && { groupKey: input.groupKey }),
      normalizedKey,
      fingerprint,
      ...(conflictKey && { conflictKey }),
      recordedAt: input.recordedAt,
    };
  }

  visit(input: {
    id: string;
    patientId: string;
    startedAt: Date;
    status: VisitStatus;
    visitType: string;
    createdAt: Date;
  }) {
    return this.build({
      patientId: input.patientId,
      visitId: input.id,
      eventType: "PATIENT_VISIT",
      title:
        input.visitType === "FOLLOW_UP" ? "Follow-up visit" : "Patient visit",
      description: humanize(input.status),
      eventDate: input.startedAt,
      source: "CLINICAL_RECORD",
      sourceType: "VISIT",
      sourceId: input.id,
      verificationStatus:
        input.status === "VERIFIED" ? "DOCTOR_VERIFIED" : "CAPTURED",
      temporalState:
        input.status === "COMPLETED" || input.status === "CANCELLED"
          ? "HISTORICAL"
          : "CURRENT",
      groupKey: `visit:${input.id}`,
      normalizedKey: "visit",
      recordedAt: input.createdAt,
    });
  }

  symptom(input: {
    id: string;
    patientId: string;
    visitId?: string | null;
    name: string;
    normalizedName: string | null;
    severity: string | null;
    duration: unknown;
    location: unknown;
    status: string | null;
    source: ClinicalSource;
    verificationStatus: VerificationStatus;
    createdAt: Date;
  }) {
    const description = [
      input.severity,
      scalar(input.duration),
      scalar(input.location),
    ]
      .filter(Boolean)
      .join(" · ");
    return this.build({
      patientId: input.patientId,
      ...(input.visitId && { visitId: input.visitId }),
      eventType: "PATIENT_REPORTED_SYMPTOM",
      title: input.name,
      ...(description && { description }),
      source: clinicalSource(input.source),
      sourceType: "SYMPTOM",
      sourceId: input.id,
      verificationStatus: clinicalVerificationStatus(
        input.verificationStatus,
        input.source,
      ),
      temporalState: "CURRENT",
      originalValue: {
        name: input.name,
        duration: input.duration,
        state: input.status,
      },
      normalizedValue: {
        name: input.normalizedName ?? input.name,
        state: input.status ?? "YES",
      },
      ...(input.visitId && { groupKey: `visit:${input.visitId}` }),
      normalizedKey: this.normalizer.key(input.normalizedName ?? input.name),
      recordedAt: input.createdAt,
    });
  }

  medication(input: {
    id: string;
    patientId: string;
    visitId: string | null;
    name: string;
    normalizedName: string | null;
    dose: string | null;
    frequency: string | null;
    source: ClinicalSource;
    verifiedAt: Date | null;
    verificationStatus: VerificationStatus;
    createdAt: Date;
  }) {
    return this.build({
      patientId: input.patientId,
      ...(input.visitId && { visitId: input.visitId }),
      eventType: "MEDICATION_RECORDED",
      title: input.name,
      description: [input.dose, input.frequency].filter(Boolean).join(" · "),
      source: clinicalSource(input.source),
      sourceType: "MEDICATION",
      sourceId: input.id,
      verificationStatus: clinicalVerificationStatus(
        input.verificationStatus,
        input.source,
      ),
      temporalState: "UNKNOWN",
      medicationAction: input.verifiedAt ? "CONFIRMED" : "REPORTED",
      originalValue: { name: input.name, dose: input.dose },
      normalizedValue: {
        name: input.normalizedName ?? input.name,
        dose: input.dose,
        frequency: input.frequency,
      },
      ...(input.visitId && { groupKey: `visit:${input.visitId}` }),
      normalizedKey: this.normalizer.key(input.normalizedName ?? input.name),
      recordedAt: input.createdAt,
    });
  }

  allergy(input: {
    id: string;
    patientId: string;
    visitId: string | null;
    allergen: string;
    reaction: string | null;
    severity: string | null;
    source: ClinicalSource;
    verifiedAt: Date | null;
    verificationStatus: VerificationStatus;
    createdAt: Date;
  }) {
    return this.build({
      patientId: input.patientId,
      ...(input.visitId && { visitId: input.visitId }),
      eventType: "ALLERGY_RECORDED",
      title: input.allergen,
      description: [input.reaction, input.severity].filter(Boolean).join(" · "),
      source: clinicalSource(input.source),
      sourceType: "ALLERGY",
      sourceId: input.id,
      verificationStatus: clinicalVerificationStatus(
        input.verificationStatus,
        input.source,
      ),
      temporalState: "UNKNOWN",
      originalValue: input.allergen,
      normalizedValue: input.allergen,
      ...(input.visitId && { groupKey: `visit:${input.visitId}` }),
      normalizedKey: this.normalizer.key(input.allergen),
      recordedAt: input.createdAt,
    });
  }

  observation(input: {
    id: string;
    patientId: string;
    visitId: string | null;
    conceptKey: string;
    display: string;
    category: string | null;
    value: unknown;
    unit: string | null;
    referenceRange: unknown;
    effectiveAt: Date | null;
    source: ClinicalSource;
    verificationStatus: VerificationStatus;
    createdAt: Date;
  }) {
    const value = scalar(input.value);
    return this.build({
      patientId: input.patientId,
      ...(input.visitId && { visitId: input.visitId }),
      eventType: input.category === "LAB" ? "LAB_RESULT" : "OBSERVATION",
      title: input.display,
      description: [value, input.unit].filter(Boolean).join(" "),
      eventDate: input.effectiveAt,
      source: clinicalSource(input.source),
      sourceType: "OBSERVATION",
      sourceId: input.id,
      verificationStatus: clinicalVerificationStatus(
        input.verificationStatus,
        input.source,
      ),
      temporalState: input.effectiveAt ? "HISTORICAL" : "UNKNOWN",
      originalValue: input.value,
      normalizedValue: {
        value: input.value,
        unit: input.unit,
        referenceRange: input.referenceRange,
      },
      ...(input.visitId && { groupKey: `visit:${input.visitId}` }),
      normalizedKey: this.normalizer.key(input.conceptKey),
      recordedAt: input.createdAt,
    });
  }

  ayush(input: {
    id: string;
    patientId: string;
    visitId: string | null;
    documentId: string | null;
    documentFactId: string | null;
    system: string;
    useStatus:
      "CURRENT" | "HISTORICAL" | "STOPPED" | "UNKNOWN" | "NOT_DOCUMENTED";
    originalName: string;
    normalizedName: string | null;
    treatmentName: string | null;
    medicineName: string | null;
    dosage: string | null;
    frequency: string | null;
    route: string | null;
    startDate: Date | null;
    endDate: Date | null;
    indicationAsReported: string | null;
    reportedEffect: string | null;
    temporalRelationship: string | null;
    source: ClinicalSource;
    verificationStatus: VerificationStatus;
    createdAt: Date;
  }) {
    const name = input.normalizedName ?? input.originalName;
    const reportedEffect = input.reportedEffect
      ? `Reported after treatment use: ${input.reportedEffect}`
      : undefined;
    return this.build({
      patientId: input.patientId,
      ...(input.visitId && { visitId: input.visitId }),
      ...(input.documentId && { documentId: input.documentId }),
      ...(input.documentFactId && { documentFactId: input.documentFactId }),
      eventType: "AYUSH_TREATMENT",
      title: `${humanize(input.system)} · ${name}`,
      description: [
        humanize(input.useStatus),
        input.dosage,
        input.frequency,
        input.route,
        input.indicationAsReported &&
          `Reported reason: ${input.indicationAsReported}`,
        reportedEffect,
      ]
        .filter(Boolean)
        .join(" · "),
      eventDate: input.startDate,
      ...(input.endDate && { eventEndDate: input.endDate }),
      source: clinicalSource(input.source),
      sourceType: "AYUSH_RECORD",
      sourceId: input.id,
      verificationStatus: clinicalVerificationStatus(
        input.verificationStatus,
        input.source,
      ),
      temporalState:
        input.useStatus === "CURRENT"
          ? "CURRENT"
          : input.useStatus === "STOPPED"
            ? "DISCONTINUED"
            : input.useStatus === "HISTORICAL"
              ? "HISTORICAL"
              : "UNKNOWN",
      ...(input.temporalRelationship && {
        temporalText: humanize(input.temporalRelationship),
      }),
      originalValue: {
        system: input.system,
        originalName: input.originalName,
        source: input.source,
      },
      normalizedValue: {
        system: input.system,
        name,
        useStatus: input.useStatus,
        dosage: input.dosage,
        frequency: input.frequency,
        route: input.route,
        reportedEffect: input.reportedEffect,
        temporalRelationship: input.temporalRelationship,
      },
      ...(input.visitId && { groupKey: `visit:${input.visitId}` }),
      normalizedKey: this.normalizer.key(`${input.system}-${name}`),
      recordedAt: input.createdAt,
    });
  }

  document(input: {
    id: string;
    patientId: string;
    visitId: string | null;
    documentType: DocumentType;
    summary: string | null;
    documentDate: Date | null;
    uploadedAt: Date;
  }) {
    const eventType: TimelineEventType =
      input.documentType === "CONSULTATION_NOTE"
        ? "CONSULTATION_NOTE"
        : input.documentType === "DISCHARGE_SUMMARY"
          ? "DISCHARGE_EVENT"
          : "MEDICAL_DOCUMENT";
    return this.build({
      patientId: input.patientId,
      ...(input.visitId && { visitId: input.visitId }),
      documentId: input.id,
      eventType,
      title: humanize(input.documentType),
      ...(input.summary && { description: input.summary }),
      eventDate: input.documentDate,
      source: "DOCUMENT_EXTRACTED",
      sourceType: "MEDICAL_DOCUMENT",
      sourceId: input.id,
      verificationStatus: "DOCUMENT_EXTRACTED",
      temporalState: input.documentDate ? "HISTORICAL" : "UNKNOWN",
      groupKey: `document:${input.id}`,
      normalizedKey: "document",
      recordedAt: input.uploadedAt,
    });
  }

  documentFact(input: {
    id: string;
    patientId: string;
    visitId: string | null;
    documentId: string;
    documentDate: Date | null;
    factType: string;
    originalValue: unknown;
    normalizedValue: unknown;
    confidence: number | null;
    status: DocumentFactStatus;
    verificationStatus: VerificationStatus;
    createdAt: Date;
    evidence: Array<{
      pageNumber: number;
      sourceText: string;
    }>;
  }) {
    const displayed =
      this.normalizer.displayValue(input.normalizedValue) ??
      this.normalizer.displayValue(input.originalValue) ??
      humanize(input.factType);
    const eventType = factEventType(input.factType);
    return this.build({
      patientId: input.patientId,
      ...(input.visitId && { visitId: input.visitId }),
      documentId: input.documentId,
      documentFactId: input.id,
      eventType,
      title: factTitle(input.factType, displayed),
      ...(eventType === "LAB_RESULT" && { description: displayed }),
      eventDate: input.documentDate,
      source: "DOCUMENT_EXTRACTED",
      sourceType: "DOCUMENT_FACT",
      sourceId: input.id,
      ...(input.evidence[0]?.sourceText && {
        sourceText: input.evidence[0].sourceText,
      }),
      ...(input.evidence[0] && { pageNumber: input.evidence[0].pageNumber }),
      verificationStatus:
        input.status === "REJECTED"
          ? "REJECTED"
          : input.status === "CONFIRMED" &&
              ![
                "DOCTOR_VERIFIED",
                "DOCTOR_CORRECTED",
                "VERIFIED",
                "EDITED",
              ].includes(input.verificationStatus)
            ? "PATIENT_CONFIRMED"
            : clinicalVerificationStatus(
                input.verificationStatus,
                "DOCUMENT_EXTRACTED",
              ),
      temporalState: "HISTORICAL",
      ...(eventType === "MEDICATION_RECORDED" && {
        medicationAction: "REPORTED" as const,
      }),
      confidence: input.confidence,
      originalValue: input.originalValue,
      normalizedValue: input.normalizedValue,
      groupKey: `document:${input.documentId}`,
      normalizedKey: this.normalizer.key(
        factConcept(input.normalizedValue, displayed),
      ),
      recordedAt: input.createdAt,
    });
  }

  risk(input: {
    id: string;
    patientId: string;
    visitId: string;
    title: string;
    description: string;
    category: string;
    severity: RiskSeverity;
    createdAt: Date;
  }) {
    return this.build({
      patientId: input.patientId,
      visitId: input.visitId,
      eventType: "RISK_SIGNAL",
      title: `Safety signal: ${input.title}`,
      description: input.description,
      eventDate: input.createdAt,
      source: "SAFETY_ENGINE",
      sourceType: "RISK_SIGNAL",
      sourceId: input.id,
      sourceText: input.category,
      verificationStatus: "AI_STRUCTURED",
      temporalState: "CURRENT",
      normalizedValue: { category: input.category, severity: input.severity },
      groupKey: `visit:${input.visitId}`,
      normalizedKey: this.normalizer.key(input.category),
      recordedAt: input.createdAt,
    });
  }

  verification(input: {
    id: string;
    patientId: string;
    visitId?: string | null;
    factType: string;
    factId: string;
    originalValue: unknown;
    verifiedValue: unknown;
    status: VerificationStatus;
    verifiedAt: Date;
  }) {
    return this.build({
      patientId: input.patientId,
      ...(input.visitId && { visitId: input.visitId }),
      eventType: "DOCTOR_VERIFICATION",
      title: `${humanize(input.factType)} reviewed`,
      eventDate: input.verifiedAt,
      source: "DOCTOR_VERIFIED",
      sourceType: "DOCTOR_VERIFICATION",
      sourceId: input.id,
      verificationStatus:
        input.status === "REJECTED" ||
        input.status === "DOCTOR_REJECTED" ||
        input.status === "SUPERSEDED"
          ? "REJECTED"
          : input.status === "NEEDS_REVIEW"
            ? "AI_STRUCTURED"
            : "DOCTOR_VERIFIED",
      temporalState: "NOT_APPLICABLE",
      originalValue: input.originalValue,
      normalizedValue: input.verifiedValue,
      ...(input.visitId && { groupKey: `visit:${input.visitId}` }),
      normalizedKey: this.normalizer.key(`${input.factType}-${input.factId}`),
      recordedAt: input.verifiedAt,
    });
  }
}

function clinicalSource(source: ClinicalSource): TimelineSource {
  if (source === "PATIENT_REPORTED") return "PATIENT_REPORTED";
  if (source === "DOCUMENT_EXTRACTED") return "DOCUMENT_EXTRACTED";
  if (source === "DOCTOR_VERIFIED") return "DOCTOR_VERIFIED";
  if (source === "SYSTEM_GENERATED") return "SYSTEM_GENERATED";
  if (source === "DOCTOR_ENTERED" || source === "AYUSH_PRACTITIONER_DOCUMENTED")
    return "CLINICAL_RECORD";
  return "VOICE_INTERVIEW";
}

function statusFromClinicalSource(source: ClinicalSource): TimelineEventStatus {
  if (source === "DOCTOR_VERIFIED") return "DOCTOR_VERIFIED";
  if (source === "DOCUMENT_EXTRACTED") return "DOCUMENT_EXTRACTED";
  if (source === "AI_STRUCTURED") return "AI_STRUCTURED";
  return "CAPTURED";
}

function clinicalVerificationStatus(
  status: VerificationStatus,
  source: ClinicalSource,
): TimelineEventStatus {
  if (
    status === "DOCTOR_VERIFIED" ||
    status === "DOCTOR_CORRECTED" ||
    status === "VERIFIED" ||
    status === "EDITED"
  )
    return "DOCTOR_VERIFIED";
  if (
    status === "DOCTOR_REJECTED" ||
    status === "SUPERSEDED" ||
    status === "REJECTED"
  )
    return "REJECTED";
  return statusFromClinicalSource(source);
}

function factEventType(factType: string): TimelineEventType {
  if (factType === "lab_result") return "LAB_RESULT";
  if (factType === "medication") return "MEDICATION_RECORDED";
  if (factType === "allergy") return "ALLERGY_RECORDED";
  if (factType === "procedure") return "PROCEDURE";
  return "OBSERVATION";
}

function factTitle(factType: string, displayed: string) {
  if (["lab_result", "medication", "allergy", "procedure"].includes(factType))
    return displayed;
  return `${humanize(factType)}: ${displayed}`;
}

function factConcept(value: unknown, fallback: string) {
  if (!value || typeof value !== "object") return fallback;
  const record = value as Record<string, unknown>;
  const concept = record.testName ?? record.name ?? record.medication;
  return typeof concept === "string" ? concept : fallback;
}

function scalar(value: unknown): string | undefined {
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const nested = record.value;
  return typeof nested === "string" || typeof nested === "number"
    ? String(nested)
    : undefined;
}

function conflictable(type: TimelineEventType) {
  return [
    "MEDICATION_RECORDED",
    "MEDICATION_CHANGED",
    "ALLERGY_RECORDED",
    "LAB_RESULT",
    "OBSERVATION",
  ].includes(type);
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}
