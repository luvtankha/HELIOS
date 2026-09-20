import { performance } from "node:perf_hooks";
import type { LanguageCode, VoiceInteractionDto } from "@helios/shared";
import type { Logger } from "pino";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { validateAudioSignature } from "../middleware/audio-upload.js";
import type { SpeechProvider } from "../providers/speech-provider.js";
import type { SessionRepository } from "../repositories/session-repository.js";
import type { VoiceInteractionRepository } from "../repositories/voice-interaction-repository.js";
import type { SessionProofService } from "../security/session-proof.js";
import { serializeVoice } from "../serializers/voice.js";
import { AppError } from "../utils/app-error.js";
import { DeterministicLanguageDetectionProvider } from "../language/language-detection.js";

export interface VoiceOperations {
  transcribe(input: {
    sessionId: string;
    sessionToken?: string;
    language: LanguageCode;
    durationSeconds: number;
    file?: Express.Multer.File;
  }): Promise<VoiceInteractionDto>;
  get(id: string, sessionToken?: string): Promise<VoiceInteractionDto>;
  edit(
    id: string,
    transcript: string,
    sessionToken?: string,
  ): Promise<VoiceInteractionDto>;
  confirm(id: string, sessionToken?: string): Promise<VoiceInteractionDto>;
}

export class VoiceService implements VoiceOperations {
  constructor(
    private readonly interactions: VoiceInteractionRepository,
    private readonly sessions: SessionRepository,
    private readonly provider: SpeechProvider,
    private readonly proof: SessionProofService,
    private readonly log: Logger = logger,
    private readonly detector = new DeterministicLanguageDetectionProvider(),
  ) {}

  async transcribe(input: {
    sessionId: string;
    sessionToken?: string;
    language: LanguageCode;
    durationSeconds: number;
    file?: Express.Multer.File;
  }) {
    const verifiedSessionId = this.proof.verify(input.sessionToken);
    if (verifiedSessionId !== input.sessionId) this.ownershipError();
    const session = await this.sessions.findVoiceContext(verifiedSessionId);
    if (!session)
      throw new AppError("Session not found", 404, "SESSION_NOT_FOUND");
    if (session.language && session.language !== input.language)
      throw new AppError(
        "The recording language does not match the active session",
        400,
        "VOICE_LANGUAGE_MISMATCH",
      );
    if (!input.file) {
      throw new AppError("Please attach a recording", 400, "AUDIO_REQUIRED");
    }
    if (input.durationSeconds > env.VOICE_MAX_DURATION_SECONDS) {
      throw new AppError(
        "The recording is longer than the allowed limit",
        413,
        "AUDIO_DURATION_EXCEEDED",
      );
    }
    validateAudioSignature(input.file);
    const supported = this.provider.getSupportedLanguages();
    if (!supported.includes(input.language)) {
      throw new AppError(
        "That language is not supported for voice yet",
        400,
        "VOICE_LANGUAGE_UNSUPPORTED",
      );
    }

    const interaction = await this.interactions.create({
      sessionId: verifiedSessionId,
      ...(session.visitId && { visitId: session.visitId }),
      language: input.language,
      provider: this.provider.id,
      ...(this.provider.model && { model: this.provider.model }),
      audioMetadata: {
        mimeType: input.file.mimetype.split(";", 1)[0],
        byteLength: input.file.size,
        durationSeconds: input.durationSeconds,
        retained: false,
      },
    });
    const started = performance.now();
    try {
      const result = await this.provider.transcribe(
        {
          bytes: input.file.buffer,
          mimeType: input.file.mimetype,
          fileName: safeAudioFileName(input.file.mimetype),
        },
        input.language,
      );
      const transcript = result.transcript.trim();
      // A pain score can be a legitimate one-character transcript (for
      // example, "7"). Keep rejecting accidental one-letter fragments.
      const shortNumericAnswer = /^(?:10|[0-9])$/.test(transcript);
      if ((transcript.length < 2 && !shortNumericAnswer) || transcript.length > 4_000) {
        throw new AppError(
          "We couldn't understand that recording",
          422,
          "TRANSCRIPT_INVALID",
        );
      }
      const detectedLanguage = this.provider.detectLanguage(result);
      const localDetection = this.detector.detectFromTranscript(
        transcript,
        input.language,
      );
      const detectedLanguages = [
        ...new Set([
          ...localDetection.detectedLanguages,
          ...(result.detectedLanguages ?? []).filter(
            (code): code is LanguageCode => code === "en" || code === "hi",
          ),
          ...(detectedLanguage === "en" || detectedLanguage === "hi"
            ? [detectedLanguage]
            : []),
        ]),
      ];
      const completed = await this.interactions.markTranscribed(
        interaction.id,
        {
          originalTranscript: transcript,
          ...(result.normalizedTranscript && {
            normalizedTranscript: result.normalizedTranscript.trim(),
          }),
          ...(detectedLanguage && {
            detectedLanguage,
          }),
          detectedLanguages,
          ...(result.confidence !== undefined && {
            confidence: Math.min(1, Math.max(0, result.confidence)),
          }),
        },
      );
      this.log.info(
        {
          operation: "voice_transcription",
          providerStatus: "success",
          provider: this.provider.id,
          latencyMs: Math.round(performance.now() - started),
        },
        "Voice transcription completed",
      );
      return serializeVoice(completed);
    } catch (error) {
      await this.interactions.markFailed(interaction.id).catch(() => undefined);
      this.log.warn(
        {
          operation: "voice_transcription",
          providerStatus: "failed",
          provider: this.provider.id,
          latencyMs: Math.round(performance.now() - started),
          errorCode: error instanceof AppError ? error.code : "SPEECH_ERROR",
        },
        "Voice transcription failed",
      );
      if (error instanceof AppError) throw error;
      throw new AppError(
        "We couldn't process your recording",
        502,
        "TRANSCRIPTION_FAILED",
      );
    }
  }

  async get(id: string, sessionToken?: string) {
    const interaction = await this.ownedInteraction(id, sessionToken);
    return serializeVoice(interaction);
  }

  async edit(id: string, transcript: string, sessionToken?: string) {
    const interaction = await this.ownedInteraction(id, sessionToken);
    if (!interaction.originalTranscript) {
      throw new AppError(
        "This recording has no transcript to edit",
        409,
        "TRANSCRIPT_NOT_READY",
      );
    }
    return serializeVoice(await this.interactions.edit(id, transcript));
  }

  async confirm(id: string, sessionToken?: string) {
    const interaction = await this.ownedInteraction(id, sessionToken);
    const accepted =
      interaction.patientEditedTranscript ?? interaction.originalTranscript;
    if (!accepted) {
      throw new AppError(
        "This recording has no transcript to confirm",
        409,
        "TRANSCRIPT_NOT_READY",
      );
    }
    return serializeVoice(await this.interactions.confirm(id, accepted));
  }

  private async ownedInteraction(id: string, token?: string) {
    const sessionId = this.proof.verify(token);
    const interaction = await this.interactions.findById(id);
    if (!interaction) {
      throw new AppError(
        "Voice interaction not found",
        404,
        "VOICE_INTERACTION_NOT_FOUND",
      );
    }
    if (interaction.sessionId !== sessionId) this.ownershipError();
    return interaction;
  }

  private ownershipError(): never {
    throw new AppError(
      "This recording does not belong to the active session",
      403,
      "VOICE_SESSION_MISMATCH",
    );
  }
}

function safeAudioFileName(mimeType: string): string {
  const clean = mimeType.toLowerCase().split(";", 1)[0];
  const extension =
    clean === "audio/ogg"
      ? "ogg"
      : clean === "audio/wav" || clean === "audio/x-wav"
        ? "wav"
        : clean === "audio/mpeg"
          ? "mp3"
          : clean === "audio/mp4" || clean === "audio/x-m4a"
            ? "m4a"
            : "webm";
  return `helios-recording.${extension}`;
}
