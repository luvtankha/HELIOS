import type { PrismaClient } from "@prisma/client";
import { MultilingualClinicalNormalizer } from "../language/clinical-normalizer.js";
import { DeterministicLanguageDetectionProvider } from "../language/language-detection.js";
import { LanguageRegistry } from "../language/language-registry.js";
import { LanguageService } from "../language/language-service.js";
import { ApprovedResourceTranslationProvider } from "../language/translation.js";
import { LanguageRepository } from "../repositories/language-repository.js";
import { DoctorProofService } from "../security/doctor-proof.js";
import { SessionProofService } from "../security/session-proof.js";

export const createLanguageService = (prisma: PrismaClient) =>
  new LanguageService(
    new LanguageRegistry(),
    new DeterministicLanguageDetectionProvider(),
    new ApprovedResourceTranslationProvider(),
    new MultilingualClinicalNormalizer(),
    new LanguageRepository(prisma),
    new SessionProofService(),
    new DoctorProofService(),
  );
