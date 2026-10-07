import { MultilingualClinicalNormalizer } from "../language/clinical-normalizer.js";
import { DeterministicLanguageDetectionProvider } from "../language/language-detection.js";
import { LanguageRegistry } from "../language/language-registry.js";
import { LanguageService } from "../language/language-service.js";
import { ApprovedResourceTranslationProvider } from "../language/translation.js";
import { SessionProofService } from "../security/session-proof.js";
export const createLanguageService = () =>
  new LanguageService(
    new LanguageRegistry(),
    new DeterministicLanguageDetectionProvider(),
    new ApprovedResourceTranslationProvider(),
    new MultilingualClinicalNormalizer(),
    new SessionProofService(),
  );
