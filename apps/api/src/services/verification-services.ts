import type { PrismaClient } from "@prisma/client";
import { VerificationRepository } from "../repositories/verification-repository.js";
import { TimelineRepository } from "../repositories/timeline-repository.js";
import { TimelineRebuildService } from "../timeline/timeline-rebuild-service.js";
import { VerificationService } from "../verification/verification-service.js";
import { LocalPrivateDocumentStorage } from "../document-ai/storage.js";

export function createVerificationService(prisma: PrismaClient) {
  return new VerificationService(
    new VerificationRepository(prisma),
    new TimelineRebuildService(new TimelineRepository(prisma)),
    new LocalPrivateDocumentStorage(),
  );
}
