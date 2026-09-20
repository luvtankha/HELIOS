import type {
  ConfidenceBand,
  LanguageCode,
  VoiceInteractionDto,
  VoiceInteractionStatus,
} from "@helios/shared";
import { languageCodes } from "@helios/shared";

interface VoiceRecord {
  id: string;
  sessionId: string;
  visitId: string | null;
  language: string;
  detectedLanguage: string | null;
  detectedLanguages?: unknown;
  originalTranscript: string | null;
  normalizedTranscript: string | null;
  patientEditedTranscript: string | null;
  acceptedTranscript: string | null;
  confidence: number | null;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
}

export function confidenceBand(confidence: number | null): ConfidenceBand {
  if (confidence === null) return "UNKNOWN";
  if (confidence >= 0.8) return "HIGH";
  if (confidence >= 0.55) return "MEDIUM";
  return "LOW";
}

export function serializeVoice(record: VoiceRecord): VoiceInteractionDto {
  const selectedLanguage = record.language as LanguageCode;
  const detectedLanguage =
    record.detectedLanguage === languageCodes.English ||
    record.detectedLanguage === languageCodes.Hindi
      ? record.detectedLanguage
      : undefined;
  let languageNotice: string | undefined;
  if (!record.detectedLanguage) {
    languageNotice =
      selectedLanguage === "hi"
        ? "हम बोली गई भाषा को लेकर पूरी तरह निश्चित नहीं हैं।"
        : "We're not sure which language was spoken.";
  } else if (detectedLanguage && detectedLanguage !== selectedLanguage) {
    languageNotice = `We detected ${detectedLanguage === languageCodes.Hindi ? "Hindi" : "English"}. Please check the transcript.`;
  }
  const detectedLanguages = Array.isArray(record.detectedLanguages)
    ? record.detectedLanguages.filter(
        (value): value is LanguageCode => value === "en" || value === "hi",
      )
    : [];
  return {
    id: record.id,
    sessionId: record.sessionId,
    ...(record.visitId && { visitId: record.visitId }),
    selectedLanguage,
    ...(detectedLanguage && { detectedLanguage }),
    ...(detectedLanguages.length && { detectedLanguages }),
    ...(languageNotice && { languageNotice }),
    ...(record.originalTranscript && {
      originalTranscript: record.originalTranscript,
    }),
    ...(record.normalizedTranscript && {
      normalizedTranscript: record.normalizedTranscript,
    }),
    ...(record.patientEditedTranscript && {
      patientEditedTranscript: record.patientEditedTranscript,
    }),
    ...(record.acceptedTranscript && {
      acceptedTranscript: record.acceptedTranscript,
    }),
    confidenceBand: confidenceBand(record.confidence),
    status: record.status as VoiceInteractionStatus,
    startedAt: record.startedAt.toISOString(),
    ...(record.completedAt && {
      completedAt: record.completedAt.toISOString(),
    }),
  };
}
