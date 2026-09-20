import type { LanguageCode, LanguageDetectionDto } from "@helios/shared";

export interface LanguageDetectionProvider {
  detectFromText(
    text: string,
    selectedLanguage?: LanguageCode,
  ): LanguageDetectionDto;
  detectFromTranscript(
    text: string,
    selectedLanguage?: LanguageCode,
  ): LanguageDetectionDto;
}

export class DeterministicLanguageDetectionProvider implements LanguageDetectionProvider {
  detectFromText(text: string, selectedLanguage?: LanguageCode) {
    const hasDevanagari = /[\u0900-\u097f]/u.test(text);
    const hasEnglish =
      /\b(?:the|and|is|pain|fever|days?|three|stomach|chest|head|vomit|breath)\b/i.test(
        text,
      );
    const hasRomanHindi =
      /\b(?:mujhe|mein|me|hai|nahi|dard|pet|teen|din|ulti|bukhar|saans|chakkar|kal)\b/i.test(
        text,
      );
    const detectedLanguages: LanguageCode[] = [];
    if (hasDevanagari || hasRomanHindi) detectedLanguages.push("hi");
    if (hasEnglish) detectedLanguages.push("en");
    if (!detectedLanguages.length && selectedLanguage)
      detectedLanguages.push(selectedLanguage);
    const primaryLanguage =
      hasDevanagari || hasRomanHindi
        ? "hi"
        : (detectedLanguages[0] ?? selectedLanguage ?? "en");
    const uncertain =
      !text.trim() || (!hasDevanagari && !hasEnglish && !hasRomanHindi);
    return {
      ...(selectedLanguage && { selectedLanguage }),
      primaryLanguage,
      detectedLanguages: [...new Set(detectedLanguages)],
      confidence: uncertain ? 0.45 : detectedLanguages.length > 1 ? 0.82 : 0.94,
      uncertain,
    };
  }

  detectFromTranscript(text: string, selectedLanguage?: LanguageCode) {
    return this.detectFromText(text, selectedLanguage);
  }
}
