import { createHash, randomUUID } from "node:crypto";
import { basename } from "node:path";
import type {
  DocumentProcessingStatusDto,
  MedicalDocumentDto,
} from "@helios/shared";
import type { Prisma } from "@prisma/client";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import type {
  DocumentClassifier,
  DocumentUnderstandingProvider,
  OCRProvider,
  OcrPage,
} from "../document-ai/types.js";
import type { DocumentStorage } from "../document-ai/storage.js";
import { storageKey } from "../document-ai/storage.js";
import { documentUnderstandingSchema } from "../document-ai/schema.js";
import { detectDocumentMime } from "../middleware/document-upload.js";
import type { DocumentRepository } from "../repositories/document-repository.js";
import {
  sessionProof,
  type SessionProofService,
} from "../security/session-proof.js";
import { serializeDocument } from "../serializers/document.js";
import { AppError } from "../utils/app-error.js";
import { DeterministicLanguageDetectionProvider } from "../language/language-detection.js";

export interface DocumentUploadInput {
  sessionId: string;
  patientId: string;
  visitId?: string;
  file: Express.Multer.File;
}

export interface DocumentTimelineProjector {
  projectDocument(documentId: string): Promise<void>;
  removeDocument(documentId: string): Promise<void>;
}

export interface DocumentAyushProjector {
  projectDocument(documentId: string): Promise<void>;
  removeDocument(documentId: string): Promise<void>;
}

export interface DocumentOperations {
  upload(
    input: DocumentUploadInput,
    token?: string,
  ): Promise<MedicalDocumentDto>;
  get(id: string, token?: string): Promise<MedicalDocumentDto>;
  status(id: string, token?: string): Promise<DocumentProcessingStatusDto>;
  list(patientId: string, token?: string): Promise<MedicalDocumentDto[]>;
  content(
    id: string,
    token?: string,
  ): Promise<{ buffer: Buffer; mimeType: string; fileName: string }>;
  startProcessing(id: string, token?: string): Promise<MedicalDocumentDto>;
  processNow(id: string, token?: string): Promise<MedicalDocumentDto>;
  updateFact(
    documentId: string,
    factId: string,
    action: "confirm" | "edit" | "reject",
    value: unknown,
    token?: string,
  ): Promise<MedicalDocumentDto>;
  overrideIdentity(id: string, token?: string): Promise<MedicalDocumentDto>;
  remove(id: string, token?: string): Promise<void>;
  safetyEligibleFacts(id: string, token?: string): Promise<unknown[]>;
}

const activeProcessingStatuses = new Set([
  "VALIDATING",
  "PREPROCESSING",
  "OCR_PROCESSING",
  "LAYOUT_PROCESSING",
  "EXTRACTING",
  "NORMALIZING",
]);

export class DocumentService implements DocumentOperations {
  private readonly languageDetector =
    new DeterministicLanguageDetectionProvider();

  constructor(
    private readonly documents: DocumentRepository,
    private readonly storage: DocumentStorage,
    private readonly ocr: OCRProvider,
    private readonly classifier: DocumentClassifier,
    private readonly understanding: DocumentUnderstandingProvider,
    private readonly proof: SessionProofService = sessionProof,
    private readonly timeline?: DocumentTimelineProjector,
    private readonly ayush?: DocumentAyushProjector,
  ) {}

  async upload(input: DocumentUploadInput, token?: string) {
    this.verifySession(input.sessionId, token);
    const context = await this.documents.sessionContext(input.sessionId);
    if (!context?.patient || context.patient.id !== input.patientId)
      throw new AppError(
        "This patient session is not ready for documents",
        403,
        "DOCUMENT_PATIENT_FORBIDDEN",
      );
    if (input.visitId && context.visit?.id !== input.visitId)
      throw new AppError(
        "This visit does not belong to the active session",
        403,
        "DOCUMENT_VISIT_FORBIDDEN",
      );
    const detectedMime = detectDocumentMime(input.file.buffer);
    if (!detectedMime || detectedMime !== input.file.mimetype)
      throw new AppError(
        "The document content does not match its file type",
        415,
        "DOCUMENT_CONTENT_INVALID",
      );
    const hash = createHash("sha256").update(input.file.buffer).digest("hex");
    const duplicate = await this.documents.findDuplicate(input.patientId, hash);
    if (duplicate)
      throw new AppError(
        "This document has already been uploaded",
        409,
        "DOCUMENT_DUPLICATE",
        {
          documentId: duplicate.id,
        },
      );
    const id = randomUUID();
    const key = storageKey(input.patientId, id, input.file.originalname);
    await this.storage.store(key, input.file.buffer);
    const record = await this.documents.create({
      id,
      patientId: input.patientId,
      ...(input.visitId && { visitId: input.visitId }),
      sessionId: input.sessionId,
      fileName: safeFileName(input.file.originalname),
      mimeType: detectedMime,
      storagePath: key,
      fileSize: input.file.size,
      fileHash: hash,
      uploadedBy: input.sessionId,
      processingStatus: "UPLOADED",
    });
    logger.info(
      { operation: "document_upload", documentId: id, status: "success" },
      "Document uploaded",
    );
    return serializeDocument(record);
  }

  async get(id: string, token?: string) {
    const { record } = await this.owned(id, token);
    return serializeDocument(record);
  }

  async status(
    id: string,
    token?: string,
  ): Promise<DocumentProcessingStatusDto> {
    const sessionId = this.proof.verify(token);
    const record = await this.documents.findStatusOwned(id, sessionId);
    if (!record)
      throw new AppError("Document not found", 404, "DOCUMENT_NOT_FOUND");
    const job = record.jobs[0];
    return {
      id: record.id,
      status: record.processingStatus,
      ...(job?.progress !== null &&
        job?.progress !== undefined && { progress: job.progress }),
      ...(job?.errorCode && { errorCode: job.errorCode }),
    };
  }

  async list(patientId: string, token?: string) {
    const sessionId = this.proof.verify(token);
    const context = await this.documents.sessionContext(sessionId);
    if (context?.patient?.id !== patientId)
      throw new AppError(
        "Documents are not available for this session",
        403,
        "DOCUMENT_PATIENT_FORBIDDEN",
      );
    return (await this.documents.listOwned(patientId, sessionId)).map(
      serializeDocument,
    );
  }

  async content(id: string, token?: string) {
    const { record } = await this.owned(id, token);
    return {
      buffer: await this.storage.read(record.storagePath),
      mimeType: record.mimeType,
      fileName: record.fileName,
    };
  }

  async startProcessing(id: string, token?: string) {
    const { record, sessionId } = await this.owned(id, token);
    const job = await this.claimProcessing(record.id, sessionId);
    setImmediate(() => {
      void this.runPipeline(record.id, sessionId, job.id).catch(
        () => undefined,
      );
    });
    return this.get(id, token);
  }

  async processNow(id: string, token?: string) {
    const { record, sessionId } = await this.owned(id, token);
    const job = await this.claimProcessing(record.id, sessionId);
    await this.runPipeline(record.id, sessionId, job.id);
    return this.get(id, token);
  }

  async updateFact(
    documentId: string,
    factId: string,
    action: "confirm" | "edit" | "reject",
    value: unknown,
    token?: string,
  ) {
    await this.owned(documentId, token);
    await this.documents.updateFact(
      factId,
      documentId,
      action === "reject" ? "REJECTED" : "CONFIRMED",
      action === "edit" ? (value as Prisma.InputJsonValue) : undefined,
    );
    await this.ayush?.projectDocument(documentId);
    await this.timeline?.projectDocument(documentId);
    return this.get(documentId, token);
  }

  async overrideIdentity(id: string, token?: string) {
    await this.owned(id, token);
    await this.documents.overrideIdentity(id);
    await this.timeline?.projectDocument(id);
    return this.get(id, token);
  }

  async remove(id: string, token?: string) {
    const { record } = await this.owned(id, token);
    await this.documents.cancel(id);
    await this.ayush?.removeDocument(id);
    await this.timeline?.removeDocument(id);
    await Promise.allSettled([
      this.storage.remove(record.storagePath),
      ...record.pages.flatMap((page) =>
        page.processedImagePath
          ? [this.storage.remove(page.processedImagePath)]
          : [],
      ),
    ]);
  }

  async safetyEligibleFacts(id: string, token?: string) {
    const { record } = await this.owned(id, token);
    if (record.identityStatus === "IDENTITY_MISMATCH") return [];
    return record.facts
      .filter((fact) => ["CONFIRMED", "VERIFIED"].includes(fact.status))
      .map((fact) => ({
        id: fact.id,
        factType: fact.factType,
        value: fact.normalizedValue ?? fact.originalValue,
        source: "DOCUMENT_EXTRACTED",
        status: fact.status,
      }));
  }

  private async runPipeline(
    documentId: string,
    sessionId: string,
    jobId: string,
  ) {
    const started = Date.now();
    const stagedImagePaths: string[] = [];
    let processedImagesCommitted = false;
    const discardStagedImages = async () => {
      if (processedImagesCommitted || !stagedImagePaths.length) return;
      await Promise.allSettled(
        stagedImagePaths.map((path) => this.storage.remove(path)),
      );
    };
    try {
      const record = await this.documents.findOwned(documentId, sessionId);
      if (!record)
        throw new AppError("Document not found", 404, "DOCUMENT_NOT_FOUND");
      if (
        !(await this.documents.setStatus(
          documentId,
          jobId,
          "PREPROCESSING",
          25,
        ))
      )
        return undefined;
      const buffer = await this.storage.read(record.storagePath);
      if (
        !(await this.documents.setStatus(
          documentId,
          jobId,
          "OCR_PROCESSING",
          40,
        ))
      )
        return undefined;
      const pages = await withTimeout(
        this.ocr.recognize({
          buffer,
          mimeType: record.mimeType,
          fileName: record.fileName,
        }),
        env.DOCUMENT_PROCESSING_TIMEOUT_MS,
      );
      if (
        !(await this.documents.setStatus(
          documentId,
          jobId,
          "LAYOUT_PROCESSING",
          55,
        ))
      )
        return undefined;
      for (const page of pages) {
        if (!page.processedImage) continue;
        const processedPath = `${record.patientId}/${documentId}/processed/${jobId}-page-${page.pageNumber}.png`;
        await this.storage.store(processedPath, page.processedImage);
        page.processedImagePath = processedPath;
        stagedImagePaths.push(processedPath);
      }
      const classification = this.classifier.classify(pages);
      if (
        !(await this.documents.setStatus(documentId, jobId, "EXTRACTING", 70))
      ) {
        await discardStagedImages();
        return undefined;
      }
      const result = await this.understandValidated(pages, classification.type);
      const documentDetection = this.languageDetector.detectFromText(
        pages.map((page) => page.text).join("\n"),
      );
      const facts = result.facts.map((fact) => ({
        ...fact,
        originalLanguage: this.languageDetector.detectFromText(
          fact.sourceText,
          documentDetection.primaryLanguage,
        ).primaryLanguage,
      }));
      if (
        !(await this.documents.setStatus(documentId, jobId, "NORMALIZING", 85))
      ) {
        await discardStagedImages();
        return undefined;
      }
      const context = await this.documents.sessionContext(sessionId);
      const finalIdentity = identityMatch(
        result.patientName,
        context?.patient?.fullName,
      );
      const saved = await this.documents.saveProcessed({
        documentId,
        jobId,
        patientId: record.patientId,
        ...(record.visitId && { visitId: record.visitId }),
        type: classification.type,
        identityStatus: finalIdentity,
        ...(result.documentDate && {
          documentDate: new Date(`${result.documentDate}T00:00:00.000Z`),
        }),
        summary: result.summary,
        pages,
        facts,
        documentLanguage: documentDetection.primaryLanguage,
        detectedLanguages: documentDetection.detectedLanguages,
        provider: this.ocr.name,
        ...(this.ocr.model && { model: this.ocr.model }),
        processingVersion: env.DOCUMENT_PROCESSING_VERSION,
        confidence: averageConfidence(pages),
      });
      if (!saved) {
        await discardStagedImages();
        return undefined;
      }
      processedImagesCommitted = true;
      await this.ayush?.projectDocument(documentId);
      await this.timeline?.projectDocument(documentId);
      logger.info(
        {
          operation: "document_processing",
          documentId,
          status: "success",
          durationMs: Date.now() - started,
        },
        "Document processing completed",
      );
      return saved;
    } catch (error) {
      const code =
        error instanceof AppError ? error.code : "DOCUMENT_PROCESSING_FAILED";
      await discardStagedImages();
      const failed = await this.documents.fail(documentId, jobId, code);
      if (!failed) return undefined;
      logger.warn(
        {
          operation: "document_processing",
          documentId,
          status: "failed",
          durationMs: Date.now() - started,
          errorCode: code,
        },
        "Document processing failed",
      );
      throw error;
    }
  }

  private async claimProcessing(documentId: string, sessionId: string) {
    const job = await this.documents.claimProcessing(documentId);
    if (job) return job;
    const current = await this.documents.findStatusOwned(documentId, sessionId);
    if (!current)
      throw new AppError("Document not found", 404, "DOCUMENT_NOT_FOUND");
    if (activeProcessingStatuses.has(current.processingStatus))
      throw new AppError(
        "This document is already being processed",
        409,
        "DOCUMENT_ALREADY_PROCESSING",
      );
    throw new AppError(
      "This document can only be processed after upload or a failed attempt",
      409,
      "DOCUMENT_PROCESSING_NOT_AVAILABLE",
    );
  }

  private async owned(id: string, token?: string) {
    const sessionId = this.proof.verify(token);
    const record = await this.documents.findOwned(id, sessionId);
    if (!record)
      throw new AppError("Document not found", 404, "DOCUMENT_NOT_FOUND");
    return { record, sessionId };
  }

  private async understandValidated(
    pages: OcrPage[],
    type: Parameters<DocumentUnderstandingProvider["understand"]>[1],
  ) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = documentUnderstandingSchema.safeParse(
        await this.understanding.understand(pages, type),
      );
      if (result.success)
        return {
          facts: result.data.facts.map((fact) => ({
            factType: fact.factType,
            originalValue: fact.originalValue,
            ...(fact.normalizedValue !== undefined && {
              normalizedValue: fact.normalizedValue,
            }),
            confidence: fact.confidence,
            pageNumber: fact.pageNumber,
            sourceText: fact.sourceText,
            ...(fact.boundingBox && { boundingBox: fact.boundingBox }),
          })),
          ...(result.data.documentDate && {
            documentDate: result.data.documentDate,
          }),
          ...(result.data.patientName && {
            patientName: result.data.patientName,
          }),
          summary: result.data.summary,
        };
    }
    throw new AppError(
      "We couldn't organize this document reliably",
      422,
      "EXTRACTION_FAILED",
    );
  }

  private verifySession(sessionId: string, token?: string) {
    if (this.proof.verify(token) !== sessionId)
      throw new AppError(
        "This document session could not be verified",
        403,
        "DOCUMENT_SESSION_INVALID",
      );
  }
}

export function identityMatch(
  extracted: string | undefined,
  expected: string | undefined,
) {
  if (!extracted) return "NOT_PRESENT" as const;
  if (!expected) return "PENDING" as const;
  const normalize = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return normalize(extracted) === normalize(expected)
    ? ("MATCHED" as const)
    : ("IDENTITY_MISMATCH" as const);
}

function averageConfidence(pages: OcrPage[]) {
  const values = pages.flatMap((page) =>
    page.confidence === undefined ? [] : [page.confidence],
  );
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function safeFileName(value: string) {
  return basename(value)
    .replace(/[^a-zA-Z0-9._ -]/g, "_")
    .slice(0, 160);
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number) {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new AppError(
                "Document processing timed out",
                504,
                "DOCUMENT_PROCESSING_TIMEOUT",
              ),
            ),
          milliseconds,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
