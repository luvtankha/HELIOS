import { afterEach, describe, expect, it, vi } from "vitest";
import { parseVoiceEventLine, patientV2Service } from "./patient-v2";

afterEach(() => vi.restoreAllMocks());

describe("patient v2 service", () => {
  it("rejects malformed session responses before they reach React", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("null", { status: 200 }));
    await expect(patientV2Service.createSession()).rejects.toThrow("Invalid HELIOS patient session");
    await expect(patientV2Service.resumeVoiceSession("voice-1", "proof", 0)).rejects.toThrow("Invalid HELIOS voice session");
  });

  it("rejects invalid realtime payloads", () => {
    expect(() => parseVoiceEventLine("null")).toThrow("Invalid HELIOS realtime event");
  });

  it("creates only the locked Hindi/Hinglish session mode", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          sessionId: "c123456789012345678901234",
          sessionToken: "v1.token.signature",
          status: "STARTED",
          currentStep: "CONSENT",
          conversationLanguage: "hi-Hinglish",
          patientId: null,
          visitId: null,
          startedAt: "2026-10-04T00:00:00",
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );

    await patientV2Service.createSession();

    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(String(init?.body))).toEqual({
      conversationLanguage: "hi-Hinglish",
    });
  });

  it("creates a barge-in Hindi/Hinglish voice-control session with patient proof", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          voiceSessionId: "cvoice1234567890123456789",
          patientSessionId: "c123456789012345678901234",
          visitId: null,
          state: "WAITING_FOR_RUNTIME",
          media: { available: false, transport: "PENDING_PHASE4_BENCHMARK", detail: "pending" },
          conversation: { languageMode: "hi-Hinglish", doctorAvatarId: "lead-general", bargeIn: true },
          lastAcknowledgedSequence: 0,
          createdAt: "2026-10-04T00:00:00Z",
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );

    await patientV2Service.createVoiceSession({
      sessionId: "c123456789012345678901234",
      sessionToken: "v1.proof.signature",
      status: "STARTED",
      currentStep: "CONSENT",
      conversationLanguage: "hi-Hinglish",
      patientId: null,
      visitId: null,
      startedAt: "2026-10-04T00:00:00",
    });

    const [, init] = fetchMock.mock.calls[0]!;
    expect(new Headers(init?.headers).get("x-session-token")).toBe("v1.proof.signature");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      capabilities: { bargeIn: true, languageMode: "hi-Hinglish" },
    });
  });

  it("validates realtime NDJSON event envelopes", () => {
    expect(
      parseVoiceEventLine(
        JSON.stringify({
          eventId: "event-1",
          voiceSessionId: "voice-1",
          sequence: 4,
          type: "doctor.speaking.caption",
          occurredAt: "2026-10-04T00:00:00Z",
          payload: { text: "Aapko pain kab se hai?" },
        }),
      ),
    ).toMatchObject({ sequence: 4, type: "doctor.speaking.caption" });
    expect(() => parseVoiceEventLine('{"sequence":0}')).toThrow();
  });

  it("preserves the existing pre-consultation consent contract on v2", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ consentId: "consent-1", accepted: true }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    await patientV2Service.recordPreConsultationConsent({
      sessionId: "c123456789012345678901234",
      sessionToken: "v1.proof.signature",
      status: "STARTED",
      currentStep: "CONSENT",
      conversationLanguage: "hi-Hinglish",
      patientId: null,
      visitId: null,
      startedAt: "2026-10-04T00:00:00",
    });

    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(String(init?.body))).toEqual({
      sessionId: "c123456789012345678901234",
      consentType: "PRE_CONSULTATION",
      accepted: true,
      version: "1.0",
    });
  });
});
