import type { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";
import {
  HeuristicDocumentClassifier,
  LocalOCRProvider,
  MockOCRProvider,
  RuleBasedDocumentUnderstandingProvider,
} from "../document-ai/providers.js";
import { LocalPrivateDocumentStorage } from "../document-ai/storage.js";
import { DocumentRepository } from "../repositories/document-repository.js";
import {
  DocumentService,
  type DocumentOperations,
} from "./document-service.js";
import { createTimelineService } from "./timeline-services.js";
import { createAyushService } from "./ayush-services.js";

export function createDocumentService(
  prisma: PrismaClient,
): DocumentOperations {
  return new DocumentService(
    new DocumentRepository(prisma),
    new LocalPrivateDocumentStorage(),
    env.DOCUMENT_OCR_PROVIDER === "local"
      ? new LocalOCRProvider()
      : new MockOCRProvider(),
    new HeuristicDocumentClassifier(),
    new RuleBasedDocumentUnderstandingProvider(),
    undefined,
    createTimelineService(prisma),
    createAyushService(prisma),
  );
}
