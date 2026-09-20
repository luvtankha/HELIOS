import type { VoiceInteractionDto } from "@helios/shared";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import type { DatabaseService } from "../src/repositories/database.js";
import type { PatientFlowOperations } from "../src/services/patient-flow-service.js";
import type { VoiceOperations } from "../src/services/voice-service.js";

const id = "cm423456789012345678901234";
const sessionId = "cm123456789012345678901234";
const dto: VoiceInteractionDto = {
  id,
  sessionId,
  selectedLanguage: "hi",
  originalTranscript: "मुझे पेट में दर्द है।",
  confidenceBand: "HIGH",
  status: "TRANSCRIBED",
  startedAt: new Date(0).toISOString(),
};
const database: DatabaseService = {
  checkConnection: async () => "up",
  disconnect: async () => undefined,
};
const patient = {} as PatientFlowOperations;
const voice = {
  transcribe: vi.fn(async () => dto),
  get: vi.fn(async () => dto),
  edit: vi.fn(async () => ({ ...dto, status: "EDITED" as const })),
  confirm: vi.fn(async () => ({ ...dto, status: "CONFIRMED" as const })),
} satisfies VoiceOperations;

describe("voice API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts a validated audio upload", async () => {
    const response = await request(createApp(database, patient, voice))
      .post("/api/v1/voice/transcribe")
      .set("x-session-token", "proof")
      .field("sessionId", sessionId)
      .field("language", "hi")
      .field("durationSeconds", "3")
      .attach("audio", Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01]), {
        filename: "recording.webm",
        contentType: "audio/webm",
      });
    expect(response.status).toBe(201);
    expect(response.body.data.originalTranscript).toContain("पेट");
    expect(voice.transcribe).toHaveBeenCalledOnce();
  });

  it("rejects unsupported upload MIME types before the provider", async () => {
    const response = await request(createApp(database, patient, voice))
      .post("/api/v1/voice/transcribe")
      .set("x-session-token", "proof")
      .field("sessionId", sessionId)
      .field("language", "en")
      .field("durationSeconds", "3")
      .attach("audio", Buffer.from("not audio"), {
        filename: "recording.txt",
        contentType: "text/plain",
      });
    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe("AUDIO_TYPE_UNSUPPORTED");
    expect(voice.transcribe).not.toHaveBeenCalled();
  });

  it("validates language and required multipart fields", async () => {
    const response = await request(createApp(database, patient, voice))
      .post("/api/v1/voice/transcribe")
      .set("x-session-token", "proof")
      .field("sessionId", sessionId)
      .field("language", "ta")
      .attach("audio", Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), {
        filename: "recording.webm",
        contentType: "audio/webm",
      });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("validates transcript edits", async () => {
    const response = await request(createApp(database, patient, voice))
      .post(`/api/v1/voice/${id}/edit`)
      .set("x-session-token", "proof")
      .send({ transcript: "" });
    expect(response.status).toBe(400);
    expect(voice.edit).not.toHaveBeenCalled();
  });
});
