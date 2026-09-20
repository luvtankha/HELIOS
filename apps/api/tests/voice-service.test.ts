import type { SpeechProvider } from "../src/providers/speech-provider.js";
import type { SessionRepository } from "../src/repositories/session-repository.js";
import type { VoiceInteractionRepository } from "../src/repositories/voice-interaction-repository.js";
import { SessionProofService } from "../src/security/session-proof.js";
import { VoiceService } from "../src/services/voice-service.js";
import { describe, expect, it, vi } from "vitest";

const sessionId = "cm123456789012345678901234";
const interactionId = "cm423456789012345678901234";
const now = new Date(0);

function audioFile(): Express.Multer.File {
  const buffer = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01]);
  return {
    fieldname: "audio",
    originalname: "patient-name-must-not-be-used.webm",
    encoding: "7bit",
    mimetype: "audio/webm",
    size: buffer.length,
    buffer,
    stream: undefined,
    destination: "",
    filename: "",
    path: "",
  } as unknown as Express.Multer.File;
}

function setup(providerOverride?: SpeechProvider) {
  let record = {
    id: interactionId,
    sessionId,
    visitId: "cm323456789012345678901234" as string | null,
    language: "en",
    detectedLanguage: null as string | null,
    originalTranscript: null as string | null,
    normalizedTranscript: null as string | null,
    patientEditedTranscript: null as string | null,
    acceptedTranscript: null as string | null,
    confidence: null as number | null,
    status: "PROCESSING",
    startedAt: now,
    completedAt: null as Date | null,
  };
  const repository = {
    create: vi.fn(async () => record),
    findById: vi.fn(async () => record),
    markTranscribed: vi.fn(
      async (_id: string, input: Record<string, unknown>) => {
        record = {
          ...record,
          ...input,
          status: "TRANSCRIBED",
          completedAt: now,
        };
        return record;
      },
    ),
    markFailed: vi.fn(async () => ({ ...record, status: "FAILED" })),
    edit: vi.fn(async (_id: string, transcript: string) => {
      record = {
        ...record,
        patientEditedTranscript: transcript,
        status: "EDITED",
      };
      return record;
    }),
    confirm: vi.fn(async (_id: string, transcript: string) => {
      record = {
        ...record,
        acceptedTranscript: transcript,
        status: "CONFIRMED",
      };
      return record;
    }),
  };
  const sessions = {
    findById: vi.fn(async () => ({ id: sessionId, visitId: record.visitId })),
    findVoiceContext: vi.fn(async () => ({
      id: sessionId,
      visitId: record.visitId,
      language: "en",
    })),
  };
  const provider: SpeechProvider = providerOverride ?? {
    id: "test",
    model: "test-model",
    transcribe: vi.fn(async () => ({
      transcript: "Original patient words",
      detectedLanguage: "en",
      confidence: 0.9,
    })),
    detectLanguage: (result) => result.detectedLanguage,
    getSupportedLanguages: () => ["en", "hi"],
  };
  const proof = new SessionProofService("a-test-secret-that-is-long-enough");
  const service = new VoiceService(
    repository as unknown as VoiceInteractionRepository,
    sessions as unknown as SessionRepository,
    provider,
    proof,
  );
  return { service, repository, proof };
}

describe("voice service", () => {
  it("transcribes without retaining audio or client filenames", async () => {
    const { service, repository, proof } = setup();
    const result = await service.transcribe({
      sessionId,
      sessionToken: proof.create(sessionId),
      language: "en",
      durationSeconds: 4,
      file: audioFile(),
    });
    expect(result.originalTranscript).toBe("Original patient words");
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        audioMetadata: expect.objectContaining({ retained: false }),
      }),
    );
    expect(JSON.stringify(repository.create.mock.calls)).not.toContain(
      "patient-name",
    );
  });

  it("accepts a one-character spoken pain score", async () => {
    const scoreProvider: SpeechProvider = {
      id: "test-score",
      transcribe: vi.fn(async () => ({ transcript: "7", detectedLanguage: "en" })),
      detectLanguage: (result) => result.detectedLanguage,
      getSupportedLanguages: () => ["en", "hi"],
    };
    const { service, proof } = setup(scoreProvider);
    await expect(
      service.transcribe({
        sessionId,
        sessionToken: proof.create(sessionId),
        language: "en",
        durationSeconds: 4,
        file: audioFile(),
      }),
    ).resolves.toMatchObject({ originalTranscript: "7" });
  });

  it("rejects a token for another session", async () => {
    const { service, proof } = setup();
    await expect(
      service.transcribe({
        sessionId,
        sessionToken: proof.create("cm999999999999999999999999"),
        language: "en",
        durationSeconds: 4,
        file: audioFile(),
      }),
    ).rejects.toMatchObject({ code: "VOICE_SESSION_MISMATCH" });
  });

  it("enforces the maximum recording duration", async () => {
    const { service, proof } = setup();
    await expect(
      service.transcribe({
        sessionId,
        sessionToken: proof.create(sessionId),
        language: "en",
        durationSeconds: 120,
        file: audioFile(),
      }),
    ).rejects.toMatchObject({ code: "AUDIO_DURATION_EXCEEDED" });
  });

  it("normalizes provider failure and records a failed attempt", async () => {
    const failingProvider: SpeechProvider = {
      id: "failing",
      transcribe: vi.fn(async () => {
        throw new Error("secret upstream detail");
      }),
      detectLanguage: () => undefined,
      getSupportedLanguages: () => ["en", "hi"],
    };
    const { service, repository, proof } = setup(failingProvider);
    await expect(
      service.transcribe({
        sessionId,
        sessionToken: proof.create(sessionId),
        language: "en",
        durationSeconds: 4,
        file: audioFile(),
      }),
    ).rejects.toMatchObject({ code: "TRANSCRIPTION_FAILED" });
    expect(repository.markFailed).toHaveBeenCalledOnce();
  });

  it("preserves original text through edit and confirms the edited text", async () => {
    const { service, proof } = setup();
    const token = proof.create(sessionId);
    const transcribed = await service.transcribe({
      sessionId,
      sessionToken: token,
      language: "en",
      durationSeconds: 4,
      file: audioFile(),
    });
    const edited = await service.edit(
      transcribed.id,
      "Corrected patient words",
      token,
    );
    const confirmed = await service.confirm(transcribed.id, token);
    expect(edited.originalTranscript).toBe("Original patient words");
    expect(confirmed.acceptedTranscript).toBe("Corrected patient words");
    expect(confirmed.originalTranscript).toBe("Original patient words");
  });

  it("creates a separate interaction for each retry", async () => {
    const { service, repository, proof } = setup();
    const input = {
      sessionId,
      sessionToken: proof.create(sessionId),
      language: "en" as const,
      durationSeconds: 4,
      file: audioFile(),
    };
    await service.transcribe(input);
    await service.transcribe(input);
    expect(repository.create).toHaveBeenCalledTimes(2);
  });
});
