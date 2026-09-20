import type { LanguageCode } from "@helios/shared";

export interface SpeechAudio {
  bytes: Buffer;
  mimeType: string;
  fileName: string;
}

export interface SpeechResult {
  transcript: string;
  normalizedTranscript?: string;
  detectedLanguage?: string;
  detectedLanguages?: string[];
  confidence?: number;
}

export interface SpeechProvider {
  readonly id: string;
  readonly model?: string;
  transcribe(audio: SpeechAudio, language: LanguageCode): Promise<SpeechResult>;
  detectLanguage(result: SpeechResult): string | undefined;
  getSupportedLanguages(): readonly LanguageCode[];
}
