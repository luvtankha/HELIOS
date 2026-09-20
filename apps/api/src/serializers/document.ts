import type { MedicalDocumentDto } from "@helios/shared";
import type { DocumentRecord } from "../repositories/document-repository.js";

export function serializeDocument(record: DocumentRecord): MedicalDocumentDto {
  const job = record.jobs[0];
  return {
    id: record.id,
    patientId: record.patientId,
    ...(record.visitId && { visitId: record.visitId }),
    fileName: record.fileName,
    mimeType: record.mimeType,
    fileSize: record.fileSize,
    documentType: record.documentType,
    processingStatus: record.processingStatus,
    ...(job?.progress !== null &&
      job?.progress !== undefined && {
        progress: job.progress,
      }),
    identityStatus: record.identityStatus,
    ...(record.documentDate && {
      documentDate: record.documentDate.toISOString(),
    }),
    ...(record.summary && { summary: record.summary }),
    ...(record.documentLanguage && {
      documentLanguage: record.documentLanguage,
    }),
    ...(Array.isArray(record.detectedLanguages) && {
      detectedLanguages: record.detectedLanguages.filter(
        (value): value is string => typeof value === "string",
      ),
    }),
    pageCount: record.pageCount,
    pages: record.pages.map((page) => ({
      id: page.id,
      pageNumber: page.pageNumber,
      ...(page.width && { width: page.width }),
      ...(page.height && { height: page.height }),
      confidenceBand: confidenceBand(page.confidence),
    })),
    facts: record.facts.map((fact) => ({
      id: fact.id,
      factType: fact.factType,
      originalValue: fact.originalValue,
      ...(fact.normalizedValue !== null && {
        normalizedValue: fact.normalizedValue,
      }),
      source: "DOCUMENT_EXTRACTED",
      confidenceBand: confidenceBand(fact.confidence),
      status: fact.status,
      ...(fact.originalLanguage && {
        originalLanguage: fact.originalLanguage,
      }),
      ...(fact.displayTranslation && {
        displayTranslation: fact.displayTranslation,
      }),
      evidence: fact.evidence.map((evidence) => ({
        id: evidence.id,
        pageNumber: evidence.pageNumber,
        sourceText: evidence.sourceText,
        ...(evidence.boundingBox && {
          boundingBox: evidence.boundingBox as {
            x: number;
            y: number;
            width: number;
            height: number;
          },
        }),
        ...(evidence.confidence !== null && {
          confidence: evidence.confidence,
        }),
      })),
    })),
    uploadedAt: record.uploadedAt.toISOString(),
    ...(job?.errorCode && { errorCode: job.errorCode }),
  };
}

function confidenceBand(value: number | null) {
  if (value !== null && value >= 0.9) return "HIGH" as const;
  if (value !== null && value >= 0.75) return "MEDIUM" as const;
  return "LOW" as const;
}
