import { languageCodes, type LanguageCode } from "@helios/shared";
import type {
  SpeechAudio,
  SpeechProvider,
  SpeechResult,
} from "./speech-provider.js";

const examples: Record<LanguageCode, SpeechResult> = {
  [languageCodes.English]: {
    transcript:
      "I have had stomach pain for three days and I feel like vomiting.",
    detectedLanguage: languageCodes.English,
    confidence: 0.96,
  },
  [languageCodes.Hindi]: {
    transcript: "मुझे तीन दिन से पेट में दर्द है और उल्टी जैसा लग रहा है।",
    normalizedTranscript:
      "I have had stomach pain for three days and I feel like vomiting.",
    detectedLanguage: languageCodes.Hindi,
    confidence: 0.94,
  },
};

export class MockSpeechProvider implements SpeechProvider {
  readonly id = "mock";
  readonly model = "helios-demo-v1";

  transcribe(_audio: SpeechAudio, language: LanguageCode) {
    return Promise.resolve(examples[language]);
  }

  detectLanguage(result: SpeechResult) {
    return result.detectedLanguage;
  }

  getSupportedLanguages() {
    return [languageCodes.English, languageCodes.Hindi] as const;
  }
}
