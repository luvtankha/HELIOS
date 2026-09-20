import type { DocumentType } from "@helios/shared";

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrBlock {
  text: string;
  boundingBox?: BoundingBox;
  confidence?: number;
}

export interface OcrPage {
  pageNumber: number;
  text: string;
  blocks: OcrBlock[];
  width?: number;
  height?: number;
  confidence?: number;
  processedImage?: Buffer;
  processedImagePath?: string;
}

export interface OcrInput {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}

export interface OCRProvider {
  readonly name: string;
  readonly model?: string;
  recognize(input: OcrInput): Promise<OcrPage[]>;
}

export interface DocumentClassification {
  type: DocumentType;
  confidence: number;
  reasons: string[];
}

export interface DocumentClassifier {
  classify(pages: OcrPage[]): DocumentClassification;
}

export interface ExtractedDocumentFact {
  factType: string;
  originalValue: unknown;
  normalizedValue?: unknown;
  confidence: number;
  pageNumber: number;
  sourceText: string;
  originalLanguage?: string;
  boundingBox?: BoundingBox;
}

export interface MedicalEntityExtractor {
  extract(pages: OcrPage[], type: DocumentType): ExtractedDocumentFact[];
}

export interface DocumentUnderstandingResult {
  facts: ExtractedDocumentFact[];
  documentDate?: string;
  patientName?: string;
  summary: string;
}

export interface DocumentUnderstandingProvider {
  readonly name: string;
  readonly model?: string;
  understand(
    pages: OcrPage[],
    type: DocumentType,
  ): Promise<DocumentUnderstandingResult>;
}
