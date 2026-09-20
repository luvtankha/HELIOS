import { languageCodes, type LanguageCode } from "@helios/shared";
import { AppError } from "../utils/app-error.js";
import type {
  SpeechAudio,
  SpeechProvider,
  SpeechResult,
} from "./speech-provider.js";

interface OpenAITranscriptionResponse {
  text?: string;
  languages?: Array<{ code?: string }>;
  logprobs?: Array<{ logprob?: number }>;
}

export class OpenAISpeechProvider implements SpeechProvider {
  readonly id = "openai";

  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly timeoutMs: number,
  ) {}

  async transcribe(
    audio: SpeechAudio,
    language: LanguageCode,
  ): Promise<SpeechResult> {
    if (!this.apiKey) {
      throw new AppError(
        "The speech service is not configured",
        503,
        "SPEECH_PROVIDER_NOT_CONFIGURED",
      );
    }

    const form = new FormData();
    form.append(
      "file",
      new Blob([Uint8Array.from(audio.bytes)], { type: audio.mimeType }),
      audio.fileName,
    );
    form.append("model", this.model);
    form.append("language", language);
    form.append("response_format", "json");
    if (this.model.includes("4o") && !this.model.includes("diarize")) {
      form.append("include[]", "logprobs");
    }

    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { authorization: `Bearer ${this.apiKey}` },
        body: form,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new AppError(
        "The speech service could not be reached",
        502,
        "SPEECH_PROVIDER_UNAVAILABLE",
      );
    }

    if (!response.ok) {
      throw new AppError(
        "The speech service could not process this recording",
        502,
        "SPEECH_PROVIDER_FAILED",
      );
    }
    const result = (await response.json()) as OpenAITranscriptionResponse;
    const transcript = result.text?.trim();
    if (!transcript) {
      throw new AppError(
        "We couldn't understand that recording",
        422,
        "TRANSCRIPT_EMPTY",
      );
    }
    const logprobs = result.logprobs
      ?.map((item) => item.logprob)
      .filter((value): value is number => typeof value === "number");
    const confidence = logprobs?.length
      ? Math.min(
          1,
          Math.max(
            0,
            Math.exp(
              logprobs.reduce((sum, value) => sum + value, 0) / logprobs.length,
            ),
          ),
        )
      : undefined;
    return {
      transcript,
      ...(result.languages?.[0]?.code && {
        detectedLanguage: result.languages[0].code,
      }),
      ...(confidence !== undefined && { confidence }),
    };
  }

  detectLanguage(result: SpeechResult) {
    return result.detectedLanguage;
  }

  getSupportedLanguages() {
    return [languageCodes.English, languageCodes.Hindi] as const;
  }
}
