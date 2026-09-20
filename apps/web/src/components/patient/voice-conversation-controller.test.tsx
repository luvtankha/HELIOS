import type { InterviewDto, InterviewResponsePreviewDto, VoiceInteractionDto } from "@helios/shared";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceConversationController } from "./voice-conversation-controller";

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  dispatch: vi.fn(),
  recordAndTranscribe: vi.fn(),
  confirmVoice: vi.fn(),
  respond: vi.fn(),
  confirmInterview: vi.fn(),
  advance: vi.fn(),
  useText: vi.fn(),
  speak: vi.fn(),
  cancel: vi.fn(),
  recordingCallback: undefined as undefined | ((result: { blob: Blob; durationSeconds: number; signal: AbortSignal }, dispatch: (event: unknown) => void) => Promise<void>),
}));

vi.mock("@/hooks/use-voice-recorder", () => ({
  useVoiceRecorder: (callback: typeof mocks.recordingCallback) => {
    mocks.recordingCallback = callback;
    return {
      state: { status: "IDLE", levels: Array.from({ length: 12 }, () => 0.2) },
      start: mocks.start,
      dispatch: mocks.dispatch,
    };
  },
}));

vi.mock("@/services/voice-service", () => ({
  voiceService: {
    recordAndTranscribe: mocks.recordAndTranscribe,
    confirm: mocks.confirmVoice,
  },
}));

vi.mock("@/services/interview-service", () => ({
  interviewService: {
    respond: mocks.respond,
    confirm: mocks.confirmInterview,
  },
}));

class TestUtterance {
  lang = "";
  rate = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(readonly text: string) {}
}

const interview: InterviewDto = {
  id: "interview-1",
  sessionId: "session-1",
  visitId: "visit-1",
  pathway: "abdominal_pain",
  status: "ACTIVE",
  completeness: 50,
  completenessMessage: "Building your health history…",
  currentQuestion: {
    id: "abdominal_pain.location",
    category: "HPI",
    text: "Where do you feel it?",
    inputType: "CHOICE",
    required: true,
    priority: 100,
  },
  state: { pathway: "abdominal_pain", facts: {}, unknownFields: [], conflicts: [] },
  responses: [],
  startedAt: new Date(0).toISOString(),
};

const interaction: VoiceInteractionDto = {
  id: "voice-1",
  sessionId: interview.sessionId,
  selectedLanguage: "en",
  originalTranscript: "Upper abdomen",
  acceptedTranscript: "Upper abdomen",
  confidenceBand: "HIGH",
  status: "CONFIRMED",
  startedAt: new Date(0).toISOString(),
};

const preview: InterviewResponsePreviewDto = {
  interview,
  response: {
    id: "response-1",
    questionId: interview.currentQuestion!.id,
    rawAnswer: "Upper abdomen",
    normalizedAnswer: { field: "location", value: "Upper abdomen", state: "YES" },
    language: "en",
    source: "PATIENT_REPORTED",
    confidenceBand: "HIGH",
    status: "STRUCTURED",
    createdAt: new Date(0).toISOString(),
  },
  needsConfirmation: true,
};

function renderController(
  language: "en" | "hi" = "en",
  question = interview.currentQuestion!,
) {
  const activeInterview = { ...interview, currentQuestion: question };
  return render(
    <VoiceConversationController
      interview={activeInterview}
      question={question}
      language={language}
      sessionId={interview.sessionId}
      sessionToken="proof"
      onAdvance={mocks.advance}
      onUseText={mocks.useText}
    />,
  );
}

describe("VoiceConversationController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.recordingCallback = undefined;
    vi.stubGlobal("SpeechSynthesisUtterance", TestUtterance);
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { cancel: mocks.cancel, speak: mocks.speak },
    });
    mocks.speak.mockImplementation((utterance: TestUtterance) => utterance.onend?.());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("speaks the current question and begins listening afterwards", () => {
    renderController();
    expect(mocks.speak).toHaveBeenCalledOnce();
    const utterance = mocks.speak.mock.calls[0]?.[0] as TestUtterance;
    expect(utterance.text).toBe("Where do you feel it?");
    expect(utterance.lang).toBe("en-IN");
    expect(mocks.start).toHaveBeenCalledOnce();
    expect(screen.getByText("LISTENING")).toBeInTheDocument();
  });

  it("uses Hindi speech settings when Hindi is selected", () => {
    renderController("hi");
    const utterance = mocks.speak.mock.calls[0]?.[0] as TestUtterance;
    expect(utterance.lang).toBe("hi-IN");
  });

  it("speaks and displays the valid options after a fixed-choice question", () => {
    renderController("en", {
      ...interview.currentQuestion!,
      options: ["Upper abdomen", "Lower abdomen", "Not sure"],
      optionValues: ["upper", "lower", "unknown"],
    });
    const utterance = mocks.speak.mock.calls[0]?.[0] as TestUtterance;
    expect(utterance.text).toContain("Your options are: Upper abdomen, Lower abdomen, Not sure");
    expect(screen.getByLabelText("Spoken answer options")).toHaveTextContent("Lower abdomen");
  });

  it("sends the confirmed transcript through the existing interview endpoints", async () => {
    mocks.recordAndTranscribe.mockResolvedValue(interaction);
    mocks.confirmVoice.mockResolvedValue(interaction);
    mocks.respond.mockResolvedValue(preview);
    mocks.confirmInterview.mockResolvedValue({ ...interview, completeness: 75 });
    renderController();

    await act(async () => {
      await mocks.recordingCallback?.(
        { blob: new Blob(["audio"]), durationSeconds: 2, signal: new AbortController().signal },
        mocks.dispatch,
      );
    });

    expect(mocks.respond).toHaveBeenCalledWith(
      interview.id,
      { questionId: interview.currentQuestion!.id, rawAnswer: "Upper abdomen", language: "en" },
      "proof",
    );
    expect(mocks.confirmInterview).toHaveBeenCalledWith(interview.id, preview.response.id, "proof");
    await act(async () => vi.advanceTimersByTimeAsync(550));
    expect(mocks.advance).toHaveBeenCalledWith(expect.objectContaining({ completeness: 75 }));
  });

  it("confirms an ambiguous answer so the server can ask its clarification", async () => {
    mocks.recordAndTranscribe.mockResolvedValue(interaction);
    mocks.confirmVoice.mockResolvedValue(interaction);
    mocks.respond.mockResolvedValue({
      ...preview,
      clarificationMessage: "Please say where the pain is located.",
      response: { ...preview.response, status: "NEEDS_CLARIFICATION" },
    });
    mocks.confirmInterview.mockResolvedValue({
      ...interview,
      currentQuestion: {
        ...interview.currentQuestion!,
        id: "clarify.location",
        text: "Is your latest answer about location correct?",
        inputType: "YES_NO",
      },
    });
    renderController();

    await act(async () => {
      await mocks.recordingCallback?.(
        { blob: new Blob(["audio"]), durationSeconds: 2, signal: new AbortController().signal },
        mocks.dispatch,
      );
    });
    expect(mocks.confirmInterview).toHaveBeenCalledWith(
      interview.id,
      preview.response.id,
      "proof",
    );
    await act(async () => vi.advanceTimersByTimeAsync(550));
    expect(mocks.advance).toHaveBeenCalledWith(
      expect.objectContaining({
        currentQuestion: expect.objectContaining({ id: "clarify.location" }),
      }),
    );
  });

  it("does not submit a fixed-choice answer until a listed option is heard", async () => {
    const choiceQuestion = {
      ...interview.currentQuestion!,
      options: ["Upper abdomen", "Lower abdomen", "Not sure"],
      optionValues: ["upper", "lower", "unknown"],
    };
    mocks.recordAndTranscribe.mockResolvedValue({ ...interaction, originalTranscript: "Something else" });
    mocks.confirmVoice.mockResolvedValue({ ...interaction, acceptedTranscript: "Something else" });
    renderController("en", choiceQuestion);

    await act(async () => {
      await mocks.recordingCallback?.(
        { blob: new Blob(["audio"]), durationSeconds: 2, signal: new AbortController().signal },
        mocks.dispatch,
      );
    });
    expect(mocks.respond).not.toHaveBeenCalled();
    expect(mocks.confirmVoice).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(700));
    expect(mocks.speak.mock.calls[1]?.[0]).toHaveProperty("text", "Please say one of the listed options.");
    expect(mocks.advance).not.toHaveBeenCalled();
  });

  it("maps a spoken option number to the server-provided option value", async () => {
    const choiceQuestion = {
      ...interview.currentQuestion!,
      options: ["Upper abdomen", "Lower abdomen", "Not sure"],
      optionValues: ["upper", "lower", "unknown"],
    };
    mocks.recordAndTranscribe.mockResolvedValue({ ...interaction, originalTranscript: "option 2" });
    mocks.confirmVoice.mockResolvedValue({ ...interaction, acceptedTranscript: "option 2" });
    mocks.respond.mockResolvedValue(preview);
    mocks.confirmInterview.mockResolvedValue(interview);
    renderController("en", choiceQuestion);

    await act(async () => {
      await mocks.recordingCallback?.(
        { blob: new Blob(["audio"]), durationSeconds: 2, signal: new AbortController().signal },
        mocks.dispatch,
      );
    });
    expect(mocks.respond).toHaveBeenCalledWith(
      interview.id,
      { questionId: choiceQuestion.id, rawAnswer: "lower", language: "en" },
      "proof",
    );
  });

  it("maps English ordinal words correctly while the interface is Hindi", async () => {
    const choiceQuestion = {
      ...interview.currentQuestion!,
      options: ["ऊपरी पेट", "निचला पेट", "पता नहीं"],
      optionValues: ["upper", "lower", "unknown"],
    };
    mocks.recordAndTranscribe.mockResolvedValue({
      ...interaction,
      originalTranscript: "first",
    });
    mocks.confirmVoice.mockResolvedValue(interaction);
    mocks.respond.mockResolvedValue(preview);
    mocks.confirmInterview.mockResolvedValue(interview);
    renderController("hi", choiceQuestion);

    await act(async () => {
      await mocks.recordingCallback?.(
        { blob: new Blob(["audio"]), durationSeconds: 2, signal: new AbortController().signal },
        mocks.dispatch,
      );
    });
    expect(mocks.respond).toHaveBeenCalledWith(
      interview.id,
      { questionId: choiceQuestion.id, rawAnswer: "upper", language: "hi" },
      "proof",
    );
  });

  it("maps higher spoken option ordinals instead of limiting choices to four", async () => {
    const choiceQuestion = {
      ...interview.currentQuestion!,
      options: ["A", "B", "C", "D", "E", "F"],
      optionValues: ["a", "b", "c", "d", "e", "f"],
    };
    mocks.recordAndTranscribe.mockResolvedValue({
      ...interaction,
      originalTranscript: "option six",
    });
    mocks.confirmVoice.mockResolvedValue(interaction);
    mocks.respond.mockResolvedValue(preview);
    mocks.confirmInterview.mockResolvedValue(interview);
    renderController("en", choiceQuestion);

    await act(async () => {
      await mocks.recordingCallback?.(
        { blob: new Blob(["audio"]), durationSeconds: 2, signal: new AbortController().signal },
        mocks.dispatch,
      );
    });
    expect(mocks.respond).toHaveBeenCalledWith(
      interview.id,
      { questionId: choiceQuestion.id, rawAnswer: "f", language: "en" },
      "proof",
    );
  });

  it("keeps a visible typed fallback when voice capture fails", async () => {
    mocks.recordAndTranscribe.mockRejectedValue(new Error("Speech service unavailable"));
    renderController();
    await act(async () => {
      await mocks.recordingCallback?.(
        { blob: new Blob(["audio"]), durationSeconds: 2, signal: new AbortController().signal },
        mocks.dispatch,
      );
    });
    expect(screen.getByText("Speech service unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Type instead" }));
    expect(mocks.useText).toHaveBeenCalledOnce();
  });
});
