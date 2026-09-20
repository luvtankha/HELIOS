import { Prisma, type PrismaClient } from "@prisma/client";
import { requireDatabase } from "./database.js";
import { AyushNormalizer } from "../ayush/ayush-normalizer.js";
import { AppError } from "../utils/app-error.js";

export class InterviewRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsert(input: {
    sessionId: string;
    visitId: string;
    pathway: string;
    state: Prisma.InputJsonValue;
    currentQuestionId?: string;
    completeness: number;
  }) {
    requireDatabase();
    return this.prisma.interview.upsert({
      where: { sessionId: input.sessionId },
      create: input,
      update: {
        pathway: input.pathway,
        state: input.state,
        currentQuestionId: input.currentQuestionId ?? null,
        completeness: input.completeness,
        status: "ACTIVE",
        completedAt: null,
      },
      include: {
        session: { select: { language: true } },
        responses: { orderBy: { createdAt: "asc" } },
      },
    });
  }

  async findById(id: string) {
    requireDatabase();
    return this.prisma.interview.findUnique({
      where: { id },
      include: {
        session: { select: { language: true } },
        responses: { orderBy: { createdAt: "asc" } },
      },
    });
  }

  /** Answer submission only needs the active question and interview state. */
  async findForResponse(id: string) {
    requireDatabase();
    return this.prisma.interview.findUnique({
      where: { id },
      select: {
        id: true,
        sessionId: true,
        visitId: true,
        pathway: true,
        state: true,
        currentQuestionId: true,
        completeness: true,
        status: true,
        startedAt: true,
        completedAt: true,
        session: { select: { language: true } },
      },
    });
  }

  async createResponse(input: {
    interviewId: string;
    questionId: string;
    rawAnswer: string;
    normalizedAnswer: Prisma.InputJsonValue;
    language: string;
    originalLanguage?: string;
    detectedLanguages?: Prisma.InputJsonValue;
    displayLanguage?: string;
    displayText?: string;
    source: "PATIENT_REPORTED" | "AI_STRUCTURED";
    confidence?: number;
    status: "STRUCTURED" | "NEEDS_CLARIFICATION";
  }) {
    requireDatabase();
    return this.prisma.interviewResponse.create({ data: input });
  }

  async findResponse(id: string) {
    requireDatabase();
    return this.prisma.interviewResponse.findUnique({
      where: { id },
      include: { interview: true },
    });
  }

  async confirmResponse(input: {
    responseId: string;
    interviewId: string;
    sessionId: string;
    expectedQuestionId: string;
    state: Prisma.InputJsonValue;
    currentQuestionId?: string;
    completeness: number;
    review: boolean;
  }) {
    requireDatabase();
    return this.prisma.$transaction(async (transaction) => {
      // Claim both records with their current state. A late retry or a second
      // tab cannot confirm a response after another answer has advanced.
      const claimedResponse = await transaction.interviewResponse.updateMany({
        where: {
          id: input.responseId,
          interviewId: input.interviewId,
          status: { in: ["STRUCTURED", "NEEDS_CLARIFICATION"] },
        },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      });
      if (claimedResponse.count !== 1) throw staleResponse();

      const advancedInterview = await transaction.interview.updateMany({
        where: {
          id: input.interviewId,
          sessionId: input.sessionId,
          currentQuestionId: input.expectedQuestionId,
          status: "ACTIVE",
        },
        data: {
          state: input.state,
          currentQuestionId: input.currentQuestionId ?? null,
          completeness: input.completeness,
          status: input.review ? "REVIEW" : "ACTIVE",
        },
      });
      if (advancedInterview.count !== 1) throw staleResponse();

      const record = await transaction.interview.findUnique({
        where: { id: input.interviewId },
        include: {
          session: { select: { language: true } },
          responses: { orderBy: { createdAt: "asc" } },
        },
      });
      if (!record) throw staleResponse();
      return record;
    });
  }

  async recordAI(input: {
    interviewId: string;
    responseId?: string;
    provider: string;
    model?: string;
    inputType: string;
    validationStatus: string;
    inputTokens?: number;
    outputTokens?: number;
    latencyMs?: number;
  }) {
    requireDatabase();
    return this.prisma.aIInteraction.create({ data: input });
  }

  async revise(
    id: string,
    state: Prisma.InputJsonValue,
    currentQuestionId: string,
    completeness: number,
  ) {
    requireDatabase();
    return this.prisma.interview.update({
      where: { id },
      data: {
        state,
        currentQuestionId,
        completeness,
        status: "ACTIVE",
        completedAt: null,
      },
      include: { responses: { orderBy: { createdAt: "asc" } } },
    });
  }

  async complete(
    id: string,
    visitId: string,
    summary: Record<string, unknown>,
  ) {
    requireDatabase();
    const now = new Date();
    const history = clinicalData(summary);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.clinicalHistory.upsert({
        where: { visitId },
        create: { visitId, ...history },
        update: history,
      });
      await transaction.interview.update({
        where: { id },
        data: {
          status: "COMPLETED",
          completeness: 1,
          currentQuestionId: null,
          completedAt: now,
        },
      });
      if (summary.ayushUse !== true) return;
      const visit = await transaction.visit.findUnique({
        where: { id: visitId },
        select: { patientId: true },
      });
      if (!visit) return;
      const interview = await transaction.interview.findUnique({
        where: { id },
        select: {
          responses: {
            where: { questionId: { startsWith: "common.ayush" } },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      const normalized = new AyushNormalizer().normalize({
        system: text(summary.ayushSystem),
        useStatus: text(summary.ayushUseStatus),
        originalName: text(summary.ayushTreatment),
      });
      const statements =
        interview?.responses.map((response) => response.rawAnswer) ?? [];
      const practitionerName = text(summary.ayushRecommendedBy);
      const startDate = date(summary.ayushStarted);
      const reportedEffect = text(summary.ayushReportedEffect);
      const record = await transaction.ayushRecord.upsert({
        where: { interviewId: id },
        create: {
          patientId: visit.patientId,
          visitId,
          interviewId: id,
          ...normalized,
          treatmentName: normalized.originalName,
          ...(practitionerName && { practitionerName }),
          ...(startDate && { startDate }),
          ...(reportedEffect && {
            reportedEffect,
            temporalRelationship: "REPORTED_AFTER",
          }),
          originalStatement: statements.join(" · "),
          source: "PATIENT_REPORTED",
          verificationStatus: "NEEDS_REVIEW",
          evidenceReferences:
            interview?.responses.map((response) => ({
              kind: "INTERVIEW",
              sourceId: response.id,
              label: response.questionId,
              sourceText: response.rawAnswer,
              language: response.language,
              normalizedValue: response.normalizedAnswer,
              occurredAt: response.createdAt.toISOString(),
            })) ?? [],
        },
        update: {
          ...normalized,
          treatmentName: normalized.originalName,
          ...(practitionerName && { practitionerName }),
          ...(startDate && { startDate }),
          ...(reportedEffect && {
            reportedEffect,
            temporalRelationship: "REPORTED_AFTER",
          }),
          originalStatement: statements.join(" · "),
          verificationStatus: "NEEDS_REVIEW",
        },
      });
      await transaction.auditLog.create({
        data: {
          action: "AYUSH_CAPTURED_FROM_INTERVIEW",
          entityType: "AyushRecord",
          entityId: record.id,
          metadata: {
            patientId: visit.patientId,
            interviewId: id,
            source: "PATIENT_REPORTED",
          },
        },
      });
      await transaction.clinicalBrief.updateMany({
        where: {
          patientId: visit.patientId,
          status: { in: ["GENERATED", "REVIEWED"] },
        },
        data: { status: "STALE" },
      });
      await transaction.comparison.updateMany({
        where: {
          patientId: visit.patientId,
          status: { in: ["GENERATED", "REVIEWED"] },
        },
        data: { status: "STALE" },
      });
    });
  }
}

function staleResponse() {
  return new AppError(
    "This answer is no longer the active response. Please answer the current question.",
    409,
    "RESPONSE_STALE",
  );
}

function text(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function date(value: unknown) {
  const valueText = text(value);
  return valueText && !Number.isNaN(Date.parse(valueText))
    ? new Date(valueText)
    : undefined;
}

function json(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : (value as Prisma.InputJsonValue);
}

function clinicalData(summary: Record<string, unknown>): ClinicalHistoryData {
  const onset = json(summary.onset);
  const duration = json(summary.duration);
  const location = json(summary.location);
  const character = json(summary.character);
  const timing = json(summary.timing);
  const aggravatingFactors = json(summary.aggravatingFactors);
  const relievingFactors = json(summary.relievingFactors);
  const associatedSymptoms = json(summary.associatedSymptoms);

  return {
    chiefComplaint: scalarText(
      summary.chiefComplaint,
      "Patient-reported concern",
    ),
    ...(onset !== undefined && { onset }),
    ...(duration !== undefined && { duration }),
    ...(summary.severity !== undefined && {
      severity: scalarText(summary.severity, "Unknown"),
    }),
    ...(location !== undefined && { location }),
    ...(character !== undefined && { character }),
    ...(timing !== undefined && { timing }),
    ...(aggravatingFactors !== undefined && { aggravatingFactors }),
    ...(relievingFactors !== undefined && { relievingFactors }),
    ...(associatedSymptoms !== undefined && { associatedSymptoms }),
    source: "PATIENT_REPORTED",
  };
}

type ClinicalHistoryData = {
  chiefComplaint: string;
  onset?: Prisma.InputJsonValue;
  duration?: Prisma.InputJsonValue;
  severity?: string;
  location?: Prisma.InputJsonValue;
  character?: Prisma.InputJsonValue;
  timing?: Prisma.InputJsonValue;
  aggravatingFactors?: Prisma.InputJsonValue;
  relievingFactors?: Prisma.InputJsonValue;
  associatedSymptoms?: Prisma.InputJsonValue;
  source: "PATIENT_REPORTED";
};

function scalarText(value: unknown, fallback: string) {
  return typeof value === "string" || typeof value === "number"
    ? `${value}`
    : fallback;
}
