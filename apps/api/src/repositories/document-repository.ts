import { randomUUID } from "node:crypto";
import type {
  DocumentFactStatus,
  DocumentIdentityStatus,
  DocumentStatus,
  DocumentType,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import type { ExtractedDocumentFact, OcrPage } from "../document-ai/types.js";
import { requireDatabase } from "./database.js";
import { AppError } from "../utils/app-error.js";

const documentInclude = {
  extraction: true,
  pages: { orderBy: { pageNumber: "asc" as const } },
  facts: {
    orderBy: { createdAt: "asc" as const },
    include: { evidence: { orderBy: { pageNumber: "asc" as const } } },
  },
  jobs: { orderBy: { createdAt: "desc" as const }, take: 1 },
} satisfies Prisma.MedicalDocumentInclude;

const documentStatusSelect = {
  id: true,
  processingStatus: true,
  jobs: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { progress: true, errorCode: true },
  },
} satisfies Prisma.MedicalDocumentSelect;

export type DocumentRecord = Prisma.MedicalDocumentGetPayload<{
  include: typeof documentInclude;
}>;

const activeProcessingStatuses: DocumentStatus[] = [
  "VALIDATING",
  "PREPROCESSING",
  "OCR_PROCESSING",
  "LAYOUT_PROCESSING",
  "EXTRACTING",
  "NORMALIZING",
];

const claimableProcessingStatuses: DocumentStatus[] = ["UPLOADED", "FAILED"];

export interface ProcessedDocumentInput {
  documentId: string;
  jobId: string;
  patientId: string;
  visitId?: string;
  type: DocumentType;
  identityStatus: DocumentIdentityStatus;
  documentDate?: Date;
  summary: string;
  pages: OcrPage[];
  facts: ExtractedDocumentFact[];
  documentLanguage?: string;
  detectedLanguages?: Prisma.InputJsonValue;
  provider: string;
  model?: string;
  processingVersion: string;
  confidence: number;
}

export class DocumentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async sessionContext(sessionId: string) {
    requireDatabase();
    return this.prisma.patientSession.findUnique({
      where: { id: sessionId },
      include: { patient: true, visit: true },
    });
  }

  async findDuplicate(patientId: string, fileHash: string) {
    requireDatabase();
    return this.prisma.medicalDocument.findFirst({
      where: { patientId, fileHash, deletedAt: null },
      include: documentInclude,
    });
  }

  async create(data: Prisma.MedicalDocumentUncheckedCreateInput) {
    requireDatabase();
    return this.prisma.medicalDocument.create({
      data,
      include: documentInclude,
    });
  }

  async findOwned(id: string, sessionId: string) {
    requireDatabase();
    return this.prisma.medicalDocument.findFirst({
      where: { id, sessionId, deletedAt: null },
      include: documentInclude,
    });
  }

  async findStatusOwned(id: string, sessionId: string) {
    requireDatabase();
    return this.prisma.medicalDocument.findFirst({
      where: { id, sessionId, deletedAt: null },
      select: documentStatusSelect,
    });
  }

  async listOwned(patientId: string, sessionId: string) {
    requireDatabase();
    return this.prisma.medicalDocument.findMany({
      where: { patientId, sessionId, deletedAt: null },
      orderBy: { uploadedAt: "desc" },
      include: documentInclude,
    });
  }

  async listForDoctor(patientId: string, take = 20) {
    requireDatabase();
    return this.prisma.medicalDocument.findMany({
      where: { patientId, deletedAt: null },
      orderBy: [{ documentDate: "desc" }, { uploadedAt: "desc" }],
      take,
      include: documentInclude,
    });
  }

  async claimProcessing(documentId: string) {
    requireDatabase();
    return this.prisma.$transaction(async (transaction) => {
      const claimed = await transaction.medicalDocument.updateMany({
        where: {
          id: documentId,
          deletedAt: null,
          processingStatus: { in: claimableProcessingStatuses },
        },
        data: { processingStatus: "VALIDATING" },
      });
      if (claimed.count !== 1) return null;
      return transaction.documentProcessingJob.create({
        data: {
          documentId,
          status: "VALIDATING",
          progress: 10,
          attempts: 1,
          startedAt: new Date(),
        },
        select: { id: true },
      });
    });
  }

  async setStatus(
    documentId: string,
    jobId: string,
    status: DocumentStatus,
    progress: number | null,
  ): Promise<boolean> {
    requireDatabase();
    return this.prisma.$transaction(async (transaction) => {
      const document = await transaction.medicalDocument.updateMany({
        where: activeDocumentWhere(documentId, jobId),
        data: { processingStatus: status },
      });
      if (document.count !== 1) return false;
      const job = await transaction.documentProcessingJob.updateMany({
        where: {
          id: jobId,
          documentId,
          status: { in: activeProcessingStatuses },
        },
        data: { status, progress },
      });
      if (job.count !== 1) throw processingStateChanged();
      return true;
    });
  }

  async saveProcessed(
    input: ProcessedDocumentInput,
  ): Promise<DocumentRecord | null> {
    requireDatabase();
    return this.prisma.$transaction(async (transaction) => {
      const locked = await transaction.medicalDocument.updateMany({
        where: activeDocumentWhere(
          input.documentId,
          input.jobId,
          "NORMALIZING",
        ),
        data: { processingStatus: "NORMALIZING" },
      });
      if (locked.count !== 1) return null;
      await transaction.documentEvidence.deleteMany({
        where: { documentFact: { documentId: input.documentId } },
      });
      await transaction.documentFact.deleteMany({
        where: { documentId: input.documentId },
      });
      await transaction.documentPage.deleteMany({
        where: { documentId: input.documentId },
      });
      const pageIds = new Map<number, string>();
      for (const page of input.pages) {
        const id = randomUUID();
        pageIds.set(page.pageNumber, id);
        await transaction.documentPage.create({
          data: {
            id,
            documentId: input.documentId,
            pageNumber: page.pageNumber,
            ...(page.processedImagePath && {
              processedImagePath: page.processedImagePath,
            }),
            ocrText: page.text,
            ...(page.width !== undefined && { width: page.width }),
            ...(page.height !== undefined && { height: page.height }),
            ...(page.confidence !== undefined && {
              confidence: page.confidence,
            }),
            processingStatus: "REVIEW_REQUIRED",
          },
        });
      }
      for (const fact of input.facts) {
        const pageId = pageIds.get(fact.pageNumber);
        await transaction.documentFact.create({
          data: {
            documentId: input.documentId,
            patientId: input.patientId,
            ...(input.visitId && { visitId: input.visitId }),
            factType: fact.factType,
            originalValue: fact.originalValue as Prisma.InputJsonValue,
            ...(fact.normalizedValue !== undefined && {
              normalizedValue: fact.normalizedValue as Prisma.InputJsonValue,
            }),
            ...(fact.originalLanguage && {
              originalLanguage: fact.originalLanguage,
            }),
            source: "DOCUMENT_EXTRACTED",
            confidence: fact.confidence,
            status:
              input.identityStatus === "IDENTITY_MISMATCH" ||
              fact.confidence < 0.8
                ? "NEEDS_REVIEW"
                : "EXTRACTED",
            evidence: {
              create: {
                ...(pageId && { pageId }),
                pageNumber: fact.pageNumber,
                sourceText: fact.sourceText,
                ...(fact.boundingBox && {
                  boundingBox:
                    fact.boundingBox as unknown as Prisma.InputJsonValue,
                }),
                confidence: fact.confidence,
              },
            },
          },
        });
      }
      await transaction.documentExtraction.upsert({
        where: { documentId: input.documentId },
        create: {
          documentId: input.documentId,
          rawText: input.pages.map((page) => page.text).join("\n\n"),
          structuredData: { factCount: input.facts.length },
          confidence: input.confidence,
          provider: input.provider,
          ...(input.model && { model: input.model }),
          processingVersion: input.processingVersion,
          status: "REVIEW_REQUIRED",
        },
        update: {
          rawText: input.pages.map((page) => page.text).join("\n\n"),
          structuredData: { factCount: input.facts.length },
          confidence: input.confidence,
          provider: input.provider,
          ...(input.model && { model: input.model }),
          processingVersion: input.processingVersion,
          status: "REVIEW_REQUIRED",
          errorCode: null,
        },
      });
      const document = await transaction.medicalDocument.updateMany({
        where: activeDocumentWhere(
          input.documentId,
          input.jobId,
          "NORMALIZING",
        ),
        data: {
          documentType: input.type,
          identityStatus: input.identityStatus,
          ...(input.documentDate && { documentDate: input.documentDate }),
          summary: input.summary,
          ...(input.documentLanguage && {
            documentLanguage: input.documentLanguage,
          }),
          ...(input.detectedLanguages && {
            detectedLanguages: input.detectedLanguages,
          }),
          pageCount: input.pages.length,
          processingStatus: "REVIEW_REQUIRED",
        },
      });
      if (document.count !== 1) throw processingStateChanged();
      const job = await transaction.documentProcessingJob.updateMany({
        where: {
          id: input.jobId,
          documentId: input.documentId,
          status: "NORMALIZING",
        },
        data: {
          status: "REVIEW_REQUIRED",
          progress: 100,
          completedAt: new Date(),
          errorCode: null,
        },
      });
      if (job.count !== 1) throw processingStateChanged();
      return transaction.medicalDocument.findUniqueOrThrow({
        where: { id: input.documentId },
        include: documentInclude,
      });
    });
  }

  async fail(documentId: string, jobId: string, errorCode: string) {
    requireDatabase();
    return this.prisma.$transaction(async (transaction) => {
      const document = await transaction.medicalDocument.updateMany({
        where: activeDocumentWhere(documentId, jobId),
        data: { processingStatus: "FAILED" },
      });
      if (document.count !== 1) return false;
      const job = await transaction.documentProcessingJob.updateMany({
        where: {
          id: jobId,
          documentId,
          status: { in: activeProcessingStatuses },
        },
        data: {
          status: "FAILED",
          progress: null,
          errorCode,
          completedAt: new Date(),
        },
      });
      if (job.count !== 1) throw processingStateChanged();
      await transaction.documentExtraction.upsert({
        where: { documentId },
        create: { documentId, status: "FAILED", errorCode },
        update: { status: "FAILED", errorCode },
      });
      return true;
    });
  }

  async updateFact(
    factId: string,
    documentId: string,
    status: DocumentFactStatus,
    normalizedValue?: Prisma.InputJsonValue,
  ) {
    requireDatabase();
    return this.prisma.documentFact.update({
      where: { id: factId, documentId },
      data: {
        status,
        ...(normalizedValue !== undefined && { normalizedValue }),
      },
      include: { evidence: true },
    });
  }

  async overrideIdentity(documentId: string) {
    requireDatabase();
    return this.prisma.$transaction(async (transaction) => {
      const document = await transaction.medicalDocument.update({
        where: { id: documentId },
        data: { identityStatus: "MANUAL_OVERRIDE" },
      });
      return document;
    });
  }

  async cancel(documentId: string) {
    requireDatabase();
    return this.prisma.$transaction(async (transaction) => {
      const document = await transaction.medicalDocument.updateMany({
        where: { id: documentId, deletedAt: null },
        data: { processingStatus: "CANCELLED", deletedAt: new Date() },
      });
      if (document.count !== 1) return false;
      await transaction.documentProcessingJob.updateMany({
        where: {
          documentId,
          status: { in: activeProcessingStatuses },
        },
        data: {
          status: "CANCELLED",
          progress: null,
          errorCode: "DOCUMENT_CANCELLED",
          completedAt: new Date(),
        },
      });
      return true;
    });
  }
}

function activeDocumentWhere(
  documentId: string,
  jobId: string,
  expectedStatus?: DocumentStatus,
): Prisma.MedicalDocumentWhereInput {
  const status = expectedStatus ?? { in: activeProcessingStatuses };
  return {
    id: documentId,
    deletedAt: null,
    processingStatus: status,
    jobs: { some: { id: jobId, status } },
  };
}

function processingStateChanged() {
  return new AppError(
    "Document processing is no longer active",
    409,
    "DOCUMENT_PROCESSING_STATE_CHANGED",
  );
}
