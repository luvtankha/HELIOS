import type {
  ClinicalSource,
  Prisma,
  PrismaClient,
  VerificationAction,
  VerificationFactType,
  VerificationStatus,
} from "@prisma/client";
import type {
  ReviewableFact,
  VerificationEvidence,
  VerificationMutation,
} from "../verification/types.js";
import { AppError } from "../utils/app-error.js";
import { requireDatabase } from "./database.js";

const patientSelect = {
  id: true,
  fullName: true,
  patientCode: true,
} as const;

export class VerificationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: Prisma.DoctorVerificationUncheckedCreateInput) {
    requireDatabase();
    return this.prisma.doctorVerification.create({ data });
  }

  async doctor(id: string) {
    requireDatabase();
    return this.prisma.user.findFirst({
      where: { id, role: { in: ["DOCTOR", "ADMIN"] }, status: "ACTIVE" },
      select: { id: true, displayName: true, role: true },
    });
  }

  async assigned(doctorId: string, patientId: string, isAdmin: boolean) {
    requireDatabase();
    if (isAdmin) return true;
    return Boolean(
      (
        await this.prisma.doctorPatientAssignment.findUnique({
          where: { doctorId_patientId: { doctorId, patientId } },
          select: { active: true },
        })
      )?.active,
    );
  }

  async assignedPatientIds(doctorId: string, isAdmin: boolean) {
    requireDatabase();
    if (isAdmin) return undefined;
    return (
      await this.prisma.doctorPatientAssignment.findMany({
        where: { doctorId, active: true },
        select: { patientId: true },
        take: 500,
      })
    ).map((row) => row.patientId);
  }

  async listFacts(
    patientId?: string,
    patientIds?: string[],
  ): Promise<ReviewableFact[]> {
    requireDatabase();
    const patientWhere = patientId
      ? { patientId }
      : patientIds
        ? { patientId: { in: patientIds } }
        : {};
    const [
      medications,
      allergies,
      observations,
      documents,
      symptoms,
      histories,
      responses,
      ayushRecords,
    ] = await Promise.all([
      this.prisma.medication.findMany({
        where: patientWhere,
        include: {
          patient: { select: patientSelect },
          visit: { select: { startedAt: true } },
        },
        take: 200,
      }),
      this.prisma.allergy.findMany({
        where: patientWhere,
        include: {
          patient: { select: patientSelect },
          visit: { select: { startedAt: true } },
        },
        take: 200,
      }),
      this.prisma.observation.findMany({
        where: patientWhere,
        include: {
          patient: { select: patientSelect },
          visit: { select: { startedAt: true } },
        },
        take: 200,
      }),
      this.prisma.documentFact.findMany({
        where: { ...patientWhere, factType: { not: "ayush_treatment" } },
        include: {
          patient: { select: patientSelect },
          visit: { select: { startedAt: true } },
          document: {
            select: { id: true, fileName: true, documentDate: true },
          },
          evidence: { orderBy: { pageNumber: "asc" } },
        },
        take: 200,
      }),
      this.prisma.symptom.findMany({
        where: Object.keys(patientWhere).length ? { visit: patientWhere } : {},
        include: { visit: { include: { patient: { select: patientSelect } } } },
        take: 200,
      }),
      this.prisma.clinicalHistory.findMany({
        where: Object.keys(patientWhere).length ? { visit: patientWhere } : {},
        include: { visit: { include: { patient: { select: patientSelect } } } },
        take: 200,
      }),
      this.prisma.interviewResponse.findMany({
        where: Object.keys(patientWhere).length
          ? { interview: { visit: patientWhere } }
          : {},
        include: {
          interview: {
            include: {
              visit: { include: { patient: { select: patientSelect } } },
            },
          },
        },
        take: 200,
      }),
      this.prisma.ayushRecord.findMany({
        where: patientWhere,
        include: {
          patient: { select: patientSelect },
          visit: { select: { startedAt: true } },
          document: {
            select: { id: true, fileName: true, documentDate: true },
          },
          documentFact: {
            include: { evidence: { orderBy: { pageNumber: "asc" } } },
          },
          interview: {
            select: {
              responses: {
                where: { questionId: { startsWith: "common.ayush" } },
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
        take: 200,
      }),
    ]);

    return [
      ...medications.map((row) => ({
        ...base(row, row.patient, row.visit?.startedAt),
        factType: "MEDICATION" as const,
        label: row.name,
        value: medicationValue(row),
        normalizedKey: row.normalizedName ?? row.name.toLowerCase(),
        evidence: clinicalEvidence(
          row.id,
          row.source,
          medicationValue(row),
          row.createdAt,
        ),
      })),
      ...allergies.map((row) => ({
        ...base(row, row.patient, row.visit?.startedAt),
        factType: "ALLERGY" as const,
        label: row.allergen,
        value: allergyValue(row),
        normalizedKey: row.allergen.toLowerCase(),
        evidence: clinicalEvidence(
          row.id,
          row.source,
          allergyValue(row),
          row.createdAt,
        ),
      })),
      ...observations.map((row) => ({
        ...base(row, row.patient, row.visit?.startedAt),
        factType: "OBSERVATION" as const,
        label: row.display,
        value: observationValue(row),
        normalizedKey: row.conceptKey.toLowerCase(),
        evidence: clinicalEvidence(
          row.id,
          row.source,
          observationValue(row),
          row.effectiveAt ?? row.createdAt,
        ),
      })),
      ...documents.map((row) => ({
        ...base(row, row.patient, row.visit?.startedAt),
        factType: "DOCUMENT_FACT" as const,
        label: human(row.factType),
        value: row.normalizedValue ?? row.originalValue,
        ...(row.confidence !== null && { confidence: row.confidence }),
        normalizedKey: documentKey(row.normalizedValue, row.factType),
        evidence: row.evidence.map((evidence) => ({
          kind: "DOCUMENT" as const,
          sourceId: evidence.id,
          label: `${row.document.fileName}, page ${evidence.pageNumber}`,
          sourceText: evidence.sourceText,
          normalizedValue: row.normalizedValue ?? undefined,
          documentId: row.document.id,
          documentName: row.document.fileName,
          pageNumber: evidence.pageNumber,
          boundingBox: evidence.boundingBox ?? undefined,
          occurredAt: row.document.documentDate ?? row.createdAt,
        })),
      })),
      ...symptoms.map((row) => ({
        ...base(row, row.visit.patient, row.visit.startedAt),
        factType: "SYMPTOM" as const,
        patientId: row.visit.patientId,
        label: row.name,
        value: symptomValue(row),
        normalizedKey: row.normalizedName ?? row.name.toLowerCase(),
        evidence: clinicalEvidence(
          row.id,
          row.source,
          symptomValue(row),
          row.createdAt,
        ),
      })),
      ...histories.map((row) => ({
        ...base(row, row.visit.patient, row.visit.startedAt),
        factType: "CLINICAL_HISTORY" as const,
        patientId: row.visit.patientId,
        label: "Chief complaint",
        value: {
          chiefComplaint: row.chiefComplaint,
          additionalNotes: row.additionalNotes,
        },
        normalizedKey: "chief-complaint",
        evidence: clinicalEvidence(
          row.id,
          row.source,
          row.chiefComplaint,
          row.createdAt,
        ),
      })),
      ...responses.map((row) => ({
        ...base(
          row,
          row.interview.visit.patient,
          row.interview.visit.startedAt,
        ),
        factType: "INTERVIEW_RESPONSE" as const,
        patientId: row.interview.visit.patientId,
        visitId: row.interview.visitId,
        label: human(row.questionId),
        value: row.normalizedAnswer ?? row.rawAnswer,
        ...(row.confidence !== null && { confidence: row.confidence }),
        normalizedKey: row.questionId,
        evidence: [
          {
            kind: "INTERVIEW" as const,
            sourceId: row.id,
            label: human(row.questionId),
            sourceText: row.rawAnswer,
            language: row.language,
            normalizedValue: row.normalizedAnswer ?? undefined,
            occurredAt: row.createdAt,
          },
        ],
      })),
      ...ayushRecords.map((row) => ({
        ...base(row, row.patient, row.visit?.startedAt),
        factType: "AYUSH_RECORD" as const,
        label: `${human(row.system)} · ${row.originalName}`,
        value: ayushValue(row),
        normalizedKey: `${row.system}:${(row.normalizedName ?? row.originalName).toLowerCase()}`,
        evidence: row.documentFact?.evidence.length
          ? row.documentFact.evidence.map((item) => ({
              kind: "DOCUMENT" as const,
              sourceId: item.id,
              label: `${row.document?.fileName ?? "AYUSH document"}, page ${item.pageNumber}`,
              sourceText: item.sourceText,
              ...(row.document?.id && { documentId: row.document.id }),
              ...(row.document?.fileName && {
                documentName: row.document.fileName,
              }),
              pageNumber: item.pageNumber,
              ...(item.boundingBox && { boundingBox: item.boundingBox }),
              occurredAt: row.document?.documentDate ?? item.createdAt,
            }))
          : row.interview?.responses.length
            ? row.interview.responses.map((item) => ({
                kind: "INTERVIEW" as const,
                sourceId: item.id,
                label: human(item.questionId),
                sourceText: item.rawAnswer,
                language: item.language,
                normalizedValue: item.normalizedAnswer ?? undefined,
                occurredAt: item.createdAt,
              }))
            : clinicalEvidence(
                row.id,
                row.source,
                ayushValue(row),
                row.createdAt,
              ),
      })),
    ];
  }

  async history(factType: VerificationFactType, factId: string) {
    requireDatabase();
    return this.prisma.doctorVerification.findMany({
      where: { factType, factId },
      orderBy: [{ verifiedAt: "desc" }, { id: "desc" }],
      include: { verifier: { select: { displayName: true } } },
    });
  }

  async metrics(patientIds?: string[]) {
    requireDatabase();
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const [verifiedToday, correctedToday, rejectedToday] = await Promise.all([
      this.prisma.doctorVerification.count({
        where: {
          action: { in: ["VERIFY", "CONFIRM_CURRENT"] },
          verifiedAt: { gte: today },
          ...(patientIds && { patientId: { in: patientIds } }),
        },
      }),
      this.prisma.doctorVerification.count({
        where: {
          action: "CORRECT",
          verifiedAt: { gte: today },
          ...(patientIds && { patientId: { in: patientIds } }),
        },
      }),
      this.prisma.doctorVerification.count({
        where: {
          action: { in: ["REJECT", "KEEP_PREVIOUS"] },
          verifiedAt: { gte: today },
          ...(patientIds && { patientId: { in: patientIds } }),
        },
      }),
    ]);
    return { verifiedToday, correctedToday, rejectedToday };
  }

  async riskVisitIds(patientIds: string[]) {
    requireDatabase();
    if (!patientIds.length) return [];
    const rows = await this.prisma.riskSignal.findMany({
      where: {
        visit: { patientId: { in: patientIds } },
        status: { in: ["OPEN", "ACKNOWLEDGED"] },
        source: { not: "FUTURE_DEMO_ONLY" },
      },
      select: { visitId: true },
      distinct: ["visitId"],
    });
    return rows.map((row) => row.visitId);
  }

  async document(documentId: string) {
    requireDatabase();
    return this.prisma.medicalDocument.findFirst({
      where: { id: documentId, deletedAt: null },
      include: {
        extraction: true,
        pages: { orderBy: { pageNumber: "asc" } },
        facts: {
          orderBy: { createdAt: "asc" },
          include: { evidence: { orderBy: { pageNumber: "asc" } } },
        },
        jobs: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
  }

  async idempotent(idempotencyKey: string) {
    requireDatabase();
    return this.prisma.doctorVerification.findUnique({
      where: { idempotencyKey },
      include: { verifier: { select: { displayName: true } } },
    });
  }

  async apply(input: VerificationMutation, fact: ReviewableFact) {
    requireDatabase();
    return this.prisma.$transaction(async (transaction) => {
      const replay = await transaction.doctorVerification.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { verifier: { select: { displayName: true } } },
      });
      if (replay) return { row: replay, replayed: true };

      const nextStatus = statusFor(input.action);
      const verifiedValue = input.correctedValue ?? fact.value;
      const updated = await updateFact(transaction, input, nextStatus);
      if (!updated)
        throw new AppError(
          "This information was updated by another doctor. Refresh the review before continuing.",
          409,
          "VERIFICATION_STALE_REVIEW",
        );

      const row = await transaction.doctorVerification.create({
        data: {
          patientId: input.patientId,
          ...(fact.visitId && { visitId: fact.visitId }),
          factType: input.factType,
          factId: input.factId,
          action: input.action,
          previousStatus: fact.verificationStatus,
          newStatus: nextStatus,
          status: nextStatus,
          originalValue: json(fact.value),
          verifiedValue: json(verifiedValue),
          sourceType: fact.sourceType,
          evidenceReferences: json(input.evidenceReferences),
          ...(input.reason && { reason: input.reason }),
          ...(input.comment && { comment: input.comment }),
          verifiedBy: input.doctorId,
          factVersion: input.expectedVersion + 1,
          idempotencyKey: input.idempotencyKey,
        },
        include: { verifier: { select: { displayName: true } } },
      });

      await transaction.auditLog.create({
        data: {
          actorUserId: input.doctorId,
          action: `CLINICAL_FACT_${input.action}`,
          entityType: input.factType,
          entityId: input.factId,
          ...(input.requestId && { requestId: input.requestId }),
          metadata: {
            patientId: input.patientId,
            verificationId: row.id,
            previousStatus: fact.verificationStatus,
            newStatus: nextStatus,
            sourceType: fact.sourceType,
            originalValue: json(fact.value),
            newValue: json(verifiedValue),
            reason: input.reason ?? null,
          },
        },
      });
      await Promise.all([
        transaction.clinicalBrief.updateMany({
          where: {
            patientId: input.patientId,
            status: { in: ["GENERATED", "REVIEWED"] },
          },
          data: { status: "STALE" },
        }),
        transaction.comparison.updateMany({
          where: {
            patientId: input.patientId,
            status: { in: ["GENERATED", "REVIEWED"] },
          },
          data: { status: "STALE" },
        }),
      ]);
      return { row, replayed: false };
    });
  }
}

function base(
  row: {
    id: string;
    patientId?: string;
    visitId?: string | null;
    source: ClinicalSource;
    verificationStatus: VerificationStatus;
    verificationVersion: number;
    createdAt: Date;
    updatedAt: Date;
  },
  patient: { id: string; fullName: string; patientCode: string },
  visitDate?: Date,
) {
  return {
    factId: row.id,
    patientId: row.patientId ?? patient.id,
    patientName: patient.fullName,
    patientCode: patient.patientCode,
    ...(row.visitId && { visitId: row.visitId }),
    ...(visitDate && { visitDate }),
    sourceType: row.source,
    verificationStatus: row.verificationStatus,
    version: row.verificationVersion,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function clinicalEvidence(
  sourceId: string,
  source: ClinicalSource,
  value: unknown,
  occurredAt: Date,
): VerificationEvidence[] {
  return [
    {
      kind: "CLINICAL_RECORD",
      sourceId,
      label: human(source),
      sourceText: display(value),
      occurredAt,
    },
  ];
}

function medicationValue(row: {
  name: string;
  dose: string | null;
  frequency: string | null;
  route: string | null;
}) {
  return {
    name: row.name,
    dose: row.dose,
    frequency: row.frequency,
    route: row.route,
  };
}
function allergyValue(row: {
  allergen: string;
  reaction: string | null;
  severity: string | null;
}) {
  return {
    allergen: row.allergen,
    reaction: row.reaction,
    severity: row.severity,
  };
}
function observationValue(row: {
  display: string;
  value: unknown;
  unit: string | null;
  referenceRange: unknown;
}) {
  return {
    display: row.display,
    value: row.value,
    unit: row.unit,
    referenceRange: row.referenceRange,
  };
}
function symptomValue(row: {
  name: string;
  severity: string | null;
  duration: unknown;
  location: unknown;
  status: string | null;
}) {
  return {
    name: row.name,
    severity: row.severity,
    duration: row.duration,
    location: row.location,
    status: row.status,
  };
}
function documentKey(value: unknown, fallback: string) {
  if (!value || typeof value !== "object") return fallback;
  const record = value as Record<string, unknown>;
  const candidate = record.name ?? record.medication ?? record.testName;
  return (
    typeof candidate === "string" || typeof candidate === "number"
      ? String(candidate)
      : fallback
  ).toLowerCase();
}
function display(value: unknown) {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}
function human(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}
function json(value: unknown): Prisma.InputJsonValue {
  return (value ?? null) as Prisma.InputJsonValue;
}

function statusFor(action: VerificationAction): VerificationStatus {
  if (action === "CORRECT") return "DOCTOR_CORRECTED";
  if (action === "REJECT" || action === "KEEP_PREVIOUS")
    return "DOCTOR_REJECTED";
  if (action === "MARK_UNCERTAIN") return "NEEDS_REVIEW";
  if (action === "SUPERSEDE") return "SUPERSEDED";
  return "DOCTOR_VERIFIED";
}

async function updateFact(
  tx: Prisma.TransactionClient,
  input: VerificationMutation,
  status: VerificationStatus,
) {
  const common = {
    verificationStatus: status,
    verificationVersion: { increment: 1 },
  };
  const where = {
    id: input.factId,
    patientId: input.patientId,
    verificationVersion: input.expectedVersion,
  };
  const correction = input.correctedValue ?? {};
  if (input.factType === "MEDICATION") {
    const result = await tx.medication.updateMany({
      where,
      data: {
        ...common,
        ...(status === "DOCTOR_VERIFIED" || status === "DOCTOR_CORRECTED"
          ? { verifiedAt: new Date() }
          : {}),
        ...(input.action === "CORRECT" ? medicationCorrection(correction) : {}),
      },
    });
    return result.count === 1;
  }
  if (input.factType === "ALLERGY") {
    const result = await tx.allergy.updateMany({
      where,
      data: {
        ...common,
        ...(status === "DOCTOR_VERIFIED" || status === "DOCTOR_CORRECTED"
          ? { verifiedAt: new Date() }
          : {}),
        ...(input.action === "CORRECT" ? allergyCorrection(correction) : {}),
      },
    });
    return result.count === 1;
  }
  if (input.factType === "OBSERVATION") {
    const result = await tx.observation.updateMany({
      where,
      data: {
        ...common,
        ...(input.action === "CORRECT"
          ? observationCorrection(correction)
          : {}),
      },
    });
    return result.count === 1;
  }
  if (input.factType === "DOCUMENT_FACT") {
    const result = await tx.documentFact.updateMany({
      where,
      data: {
        ...common,
        ...(input.action === "CORRECT"
          ? { normalizedValue: json(correction) }
          : {}),
        ...(status === "DOCTOR_REJECTED"
          ? { status: "REJECTED" as const }
          : {}),
        ...(status === "DOCTOR_VERIFIED" || status === "DOCTOR_CORRECTED"
          ? { status: "VERIFIED" as const }
          : {}),
        ...(status === "NEEDS_REVIEW"
          ? { status: "NEEDS_REVIEW" as const }
          : {}),
      },
    });
    return result.count === 1;
  }
  if (input.factType === "SYMPTOM") {
    const result = await tx.symptom.updateMany({
      where: {
        id: input.factId,
        visit: { patientId: input.patientId },
        verificationVersion: input.expectedVersion,
      },
      data: {
        ...common,
        ...(input.action === "CORRECT" ? symptomCorrection(correction) : {}),
      },
    });
    return result.count === 1;
  }
  if (input.factType === "CLINICAL_HISTORY") {
    const result = await tx.clinicalHistory.updateMany({
      where: {
        id: input.factId,
        visit: { patientId: input.patientId },
        verificationVersion: input.expectedVersion,
      },
      data: {
        ...common,
        ...(input.action === "CORRECT" ? historyCorrection(correction) : {}),
      },
    });
    return result.count === 1;
  }
  if (input.factType === "AYUSH_RECORD") {
    const result = await tx.ayushRecord.updateMany({
      where,
      data: {
        ...common,
        ...(input.action === "CORRECT" ? ayushCorrection(correction) : {}),
      },
    });
    return result.count === 1;
  }
  const result = await tx.interviewResponse.updateMany({
    where: {
      id: input.factId,
      interview: { visit: { patientId: input.patientId } },
      verificationVersion: input.expectedVersion,
    },
    data: {
      ...common,
      ...(input.action === "CORRECT"
        ? { normalizedAnswer: json(correction) }
        : {}),
    },
  });
  return result.count === 1;
}

function medicationCorrection(value: Record<string, unknown>) {
  return pickStrings(value, [
    "name",
    "normalizedName",
    "dose",
    "frequency",
    "route",
  ]);
}
function allergyCorrection(value: Record<string, unknown>) {
  return pickStrings(value, ["allergen", "reaction", "severity"]);
}
function observationCorrection(value: Record<string, unknown>) {
  return {
    ...pickStrings(value, ["display", "unit"]),
    ...(value.value !== undefined && { value: json(value.value) }),
    ...(value.referenceRange !== undefined && {
      referenceRange: json(value.referenceRange),
    }),
  };
}
function symptomCorrection(value: Record<string, unknown>) {
  return {
    ...pickStrings(value, ["name", "normalizedName", "severity", "status"]),
    ...(value.duration !== undefined && { duration: json(value.duration) }),
    ...(value.location !== undefined && { location: json(value.location) }),
  };
}
function historyCorrection(value: Record<string, unknown>) {
  return pickStrings(value, ["chiefComplaint", "severity", "additionalNotes"]);
}
function ayushCorrection(value: Record<string, unknown>) {
  const validSystems = [
    "AYURVEDA",
    "YOGA_NATUROPATHY",
    "UNANI",
    "SIDDHA",
    "HOMOEOPATHY",
    "OTHER_TRADITIONAL_SYSTEM",
    "UNKNOWN",
  ];
  const validStates = [
    "CURRENT",
    "HISTORICAL",
    "STOPPED",
    "UNKNOWN",
    "NOT_DOCUMENTED",
  ];
  return {
    ...pickStrings(value, [
      "practitionerName",
      "practitionerRegistrationId",
      "facilityName",
      "treatmentName",
      "medicineName",
      "normalizedName",
      "dosage",
      "frequency",
      "route",
      "indicationAsReported",
      "patientReportedReason",
      "reportedEffect",
      "notes",
    ]),
    ...(typeof value.system === "string" && validSystems.includes(value.system)
      ? { system: value.system as import("@prisma/client").AyushSystem }
      : {}),
    ...(typeof value.useStatus === "string" &&
    validStates.includes(value.useStatus)
      ? {
          useStatus: value.useStatus as import("@prisma/client").AyushUseStatus,
        }
      : {}),
    ...(Array.isArray(value.ingredients)
      ? { ingredients: json(value.ingredients) }
      : {}),
    ...(validDate(value.startDate)
      ? { startDate: new Date(value.startDate) }
      : {}),
    ...(validDate(value.endDate) ? { endDate: new Date(value.endDate) } : {}),
  };
}
function ayushValue(row: {
  system: string;
  useStatus: string;
  practitionerName: string | null;
  practitionerRegistrationId: string | null;
  facilityName: string | null;
  treatmentName: string | null;
  medicineName: string | null;
  originalName: string;
  normalizedName: string | null;
  ingredients: unknown;
  dosage: string | null;
  frequency: string | null;
  route: string | null;
  startDate: Date | null;
  endDate: Date | null;
  indicationAsReported: string | null;
  patientReportedReason: string | null;
  reportedEffect: string | null;
  notes: string | null;
}) {
  return {
    system: row.system,
    useStatus: row.useStatus,
    originalName: row.originalName,
    normalizedName: row.normalizedName,
    treatmentName: row.treatmentName,
    medicineName: row.medicineName,
    ingredients: row.ingredients ?? "NOT_DOCUMENTED",
    dosage: row.dosage,
    frequency: row.frequency,
    route: row.route,
    practitionerName: row.practitionerName,
    practitionerRegistrationId: row.practitionerRegistrationId,
    facilityName: row.facilityName,
    startDate: row.startDate?.toISOString() ?? null,
    endDate: row.endDate?.toISOString() ?? null,
    indicationAsReported: row.indicationAsReported,
    patientReportedReason: row.patientReportedReason,
    reportedEffect: row.reportedEffect,
    notes: row.notes,
  };
}
function validDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}
function pickStrings(value: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(
    keys.flatMap((key) =>
      typeof value[key] === "string" || value[key] === null
        ? [[key, value[key]]]
        : [],
    ),
  );
}
