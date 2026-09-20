import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ComplaintVoiceConversation } from "./complaint-voice-conversation";

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  dispatch: vi.fn(),
  transcribe: vi.fn(),
  confirm: vi.fn(),
  speak: vi.fn(),
  cancel: vi.fn(),
  callback: undefined as undefined | ((result: { blob: Blob; durationSeconds: number; signal: AbortSignal }, dispatch: (event: unknown) => void) => Promise<void>),
}));

vi.mock("@/hooks/use-voice-recorder", () => ({
  useVoiceRecorder: (callback: typeof mocks.callback) => {
    mocks.callback = callback;
    return { state: { status: "IDLE", levels: [] }, start: mocks.start, dispatch: mocks.dispatch };
  },
}));

vi.mock("@/services/voice-service", () => ({
  voiceService: { recordAndTranscribe: mocks.transcribe, confirm: mocks.confirm },
}));

class TestUtterance {
  lang = "";
  rate = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly text: string) {}
}

describe("ComplaintVoiceConversation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.callback = undefined;
    vi.stubGlobal("SpeechSynthesisUtterance", TestUtterance);
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { speak: mocks.speak, cancel: mocks.cancel } });
    mocks.speak.mockImplementation((utterance: TestUtterance) => utterance.onend?.());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("speaks the complaint question, listens automatically, and saves the confirmed transcript", async () => {
    const onComplaint = vi.fn();
    mocks.transcribe.mockResolvedValue({ id: "voice-1", originalTranscript: "I have chest pain" });
    mocks.confirm.mockResolvedValue({ id: "voice-1", acceptedTranscript: "I have chest pain" });
    render(<ComplaintVoiceConversation language="en" sessionId="session-1" sessionToken="proof" onComplaint={onComplaint} onUseText={vi.fn()} />);
    expect((mocks.speak.mock.calls[0]?.[0] as TestUtterance).text).toContain("what health problem");
    expect(mocks.start).toHaveBeenCalledOnce();
    expect(screen.getByText("LISTENING")).toBeInTheDocument();

    await act(async () => {
      await mocks.callback?.({ blob: new Blob(["audio"]), durationSeconds: 2, signal: new AbortController().signal }, mocks.dispatch);
    });
    await act(async () => vi.advanceTimersByTimeAsync(450));
    expect(onComplaint).toHaveBeenCalledWith("I have chest pain");
  });
});
