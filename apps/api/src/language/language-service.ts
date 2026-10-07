import { performance } from "node:perf_hooks";
import type { LanguageCode, TranslationContext } from "@helios/shared";
import type { Logger } from "pino";
import { logger } from "../config/logger.js";
import type { SessionProofService } from "../security/session-proof.js";
import { MultilingualClinicalNormalizer } from "./clinical-normalizer.js";
import type { LanguageDetectionProvider } from "./language-detection.js";
import { LanguageRegistry } from "./language-registry.js";
import type { TranslationProvider } from "./translation.js";
export interface LanguageOperations {
  list(): unknown;
  get(code: string): unknown;
  detect(
    text: string,
    selectedLanguage: LanguageCode | undefined,
    sessionToken?: string,
  ): unknown;
  normalize(
    text: string,
    language: LanguageCode,
    sessionToken?: string,
  ): unknown;
  translate(
    input: {
      text: string;
      sourceLanguage: LanguageCode;
      targetLanguage: LanguageCode;
      contextType: TranslationContext;
    },
    sessionToken?: string,
  ): Promise<unknown>;
}
export class LanguageService implements LanguageOperations {
  constructor(
    private readonly registry: LanguageRegistry,
    private readonly detector: LanguageDetectionProvider,
    private readonly translator: TranslationProvider,
    private readonly normalizer: MultilingualClinicalNormalizer,
    private readonly sessionProof: SessionProofService,
    private readonly log: Logger = logger,
  ) {}
  list() {
    return this.registry.list();
  }
  get(code: string) {
    return this.registry.get(code);
  }
  detect(text: string, selectedLanguage?: LanguageCode, sessionToken?: string) {
    this.sessionProof.verify(sessionToken);
    const result = this.detector.detectFromText(text, selectedLanguage);
    this.metric(
      "language_detection",
      "deterministic",
      result.uncertain ? "uncertain" : "success",
      0,
      result.primaryLanguage,
    );
    return result;
  }
  normalize(text: string, language: LanguageCode, sessionToken?: string) {
    this.sessionProof.verify(sessionToken);
    const started = performance.now();
    const result = this.normalizer.normalize(text, language);
    this.metric(
      "clinical_normalization",
      "rules",
      result.needsClarification ? "uncertain" : "success",
      started,
      language,
    );
    return result;
  }
  async translate(
    input: {
      text: string;
      sourceLanguage: LanguageCode;
      targetLanguage: LanguageCode;
      contextType: TranslationContext;
    },
    sessionToken?: string,
  ) {
    this.sessionProof.verify(sessionToken);
    this.registry.active(input.sourceLanguage);
    this.registry.active(input.targetLanguage);
    const started = performance.now();
    const result = await this.translator.translate(input);
    this.metric(
      "translation",
      this.translator.id,
      result.fallbackUsed ? "fallback" : "success",
      started,
      input.targetLanguage,
    );
    return result;
  }
  private metric(
    operation: string,
    provider: string,
    status: string,
    started: number,
    language: string,
  ) {
    this.log.info(
      {
        operation,
        provider,
        status,
        language,
        latencyMs: started ? Math.round(performance.now() - started) : 0,
      },
      "Language operation completed",
    );
  }
}
