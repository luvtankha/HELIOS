import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useV2VoiceSession } from "./use-v2-voice-session";
import type { V2PatientSession, V2VoiceSession } from "@/services/patient-v2";

const mocks = vi.hoisted(() => ({
  createVoiceSession: vi.fn(),
}));

vi.mock("@/services/patient-v2", async () => {
  const actual = await vi.importActual<typeof import("@/services/patient-v2")>(
    "@/services/patient-v2",
  );
  return {
    ...actual,
    patientV2Service: {
      ...actual.patientV2Service,
      createVoiceSession: mocks.createVoiceSession,
    },
  };
});

const consentSession: V2PatientSession = {
  sessionId: "c123456789012345678901234",
  sessionToken: "synthetic-proof",
  status: "STARTED",
  currentStep: "CONSENT",
  conversationLanguage: "hi-Hinglish",
  patientId: null,
  visitId: null,
  startedAt: "2026-10-04T00:00:00Z",
};

const voiceSession: V2VoiceSession = {
  voiceSessionId: "c223456789012345678901234",
  patientSessionId: consentSession.sessionId,
  visitId: null,
  state: "WAITING_FOR_RUNTIME",
  media: {
    available: false,
    transport: "PENDING_PHASE4_BENCHMARK",
    websocketUrl: null,
    credential: null,
    expiresAt: null,
    detail: "benchmark pending",
  },
  conversation: {
    languageMode: "hi-Hinglish",
    doctorAvatarId: "lead-general",
    bargeIn: true,
  },
  lastAcknowledgedSequence: 0,
  createdAt: "2026-10-04T00:00:00Z",
};

describe("useV2VoiceSession", () => {
  beforeEach(() => {
    mocks.createVoiceSession.mockReset();
    mocks.createVoiceSession.mockResolvedValue(voiceSession);
  });

  it("does not create live voice before explicit consent", async () => {
    const { result } = renderHook(() => useV2VoiceSession(consentSession));
    await waitFor(() => expect(result.current.status).toBe("idle"));
    expect(mocks.createVoiceSession).not.toHaveBeenCalled();
  });

  it("creates voice automatically after consent advances the session", async () => {
    const consented = { ...consentSession, currentStep: "BASIC_INFO" };
    const { result } = renderHook(() => useV2VoiceSession(consented));

    await waitFor(() => expect(result.current.status).toBe("blocked"));
    expect(mocks.createVoiceSession).toHaveBeenCalledWith(
      consented,
      expect.any(AbortSignal),
    );
  });
});
