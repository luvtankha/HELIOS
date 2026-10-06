import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { primeLiveAudio, useV2VoiceMedia } from "./use-v2-voice-media";
import { PatientV2ApiError, type V2VoiceSession } from "@/services/patient-v2";

const mocks = vi.hoisted(() => ({ resume: vi.fn(), patient: vi.fn() }));
vi.mock("@/services/patient-v2", async () => {
  const actual = await vi.importActual<typeof import("@/services/patient-v2")>("@/services/patient-v2");
  return { ...actual, patientV2Service: { ...actual.patientV2Service, resumeVoiceSession: mocks.resume, getSession: mocks.patient } };
});

class Socket {
  static OPEN = 1;
  static latest: Socket;
  readyState = 1;
  binaryType = "";
  onopen?: () => void;
  onclose?: () => void;
  onmessage?: (event: { data: string | ArrayBuffer }) => void;
  send = vi.fn();
  close = vi.fn(() => { this.readyState = 3; this.onclose?.(); });
  constructor() { Socket.latest = this; }
  message(value: object) { this.onmessage?.({ data: JSON.stringify(value) }); }
}

class AudioStub {
  state = "running";
  sampleRate = 24_000;
  currentTime = 0;
  destination = {};
  resume = vi.fn(async () => undefined);
  close = vi.fn(async () => { this.state = "closed"; });
  createMediaStreamSource() { throw new Error("audio device disconnected"); }
}

const voice: V2VoiceSession = {
  voiceSessionId: "voice", patientSessionId: "patient", visitId: null,
  state: "CONNECTING", lastAcknowledgedSequence: 0, createdAt: "2026-10-04",
  media: { available: true, transport: "WEBSOCKET_PCM16", websocketUrl: "ws://localhost:9090/stream", credential: "test-ticket", expiresAt: null, detail: null },
  conversation: { languageMode: "hi-Hinglish", doctorAvatarId: "lead-general", bargeIn: true },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("WebSocket", Socket);
  vi.stubGlobal("AudioContext", AudioStub);
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

function setup() {
  const stop = vi.fn();
  const streamRef = { current: { getTracks: () => [{ stop }] } as unknown as MediaStream };
  const dispatch = vi.fn();
  const hook = renderHook(() => useV2VoiceMedia(voice, "proof", "ready", streamRef, dispatch));
  return { ...hook, stop, dispatch };
}

describe("native media recovery", () => {
  it("closes the connection and stops tracks when audio capture fails, ignoring late frames", async () => {
    const { result, stop, dispatch } = setup();
    await act(async () => Socket.latest.message({ type: "ready" }));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(stop).toHaveBeenCalledOnce();
    expect(Socket.latest.close).toHaveBeenCalledOnce();
    const count = dispatch.mock.calls.length;
    act(() => Socket.latest.message({ type: "caption", text: "late caption" }));
    expect(dispatch).toHaveBeenCalledTimes(count);
    expect(mocks.resume).not.toHaveBeenCalled();
  });

  it("recovers a lost completion message from the persisted patient session", async () => {
    vi.useFakeTimers();
    mocks.resume.mockRejectedValue(new PatientV2ApiError("completed", 409));
    mocks.patient.mockResolvedValue({ currentStep: "REVIEW" });
    const { stop, dispatch, result } = setup();
    act(() => Socket.latest.close());
    await act(async () => vi.advanceTimersByTimeAsync(750));
    expect(mocks.patient).toHaveBeenCalledWith("patient", "proof", expect.any(AbortSignal));
    expect(dispatch).toHaveBeenCalledWith({ type: "conversation.completed", sequence: 0, local: true });
    expect(stop).toHaveBeenCalledOnce();
    expect(result.current.status).toBe("idle");
  });

  it("does not throw from the consent gesture in browsers without AudioContext", () => {
    vi.stubGlobal("AudioContext", undefined);
    expect(() => primeLiveAudio()).not.toThrow();
  });
});
