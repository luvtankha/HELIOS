import type { InterviewDto, InterviewResponsePreviewDto } from "@helios/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InterviewPage from "./page";

const mocks = vi.hoisted(() => ({
  hydrated: true,
  sessionReady: true,
  push: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
  respond: vi.fn(),
  confirm: vi.fn(),
  complete: vi.fn(),
  revise: vi.fn(),
  setAnswer: vi.fn(),
  setInterviewId: vi.fn(),
  setPendingQuestionId: vi.fn(),
  saveInterview: vi.fn(async () => undefined),
}));

const interview: InterviewDto = {
  id: "cm423456789012345678901234",
  sessionId: "cm123456789012345678901234",
  visitId: "cm323456789012345678901234",
  pathway: "abdominal_pain",
  status: "ACTIVE",
  completeness: 50,
  completenessMessage: "Building your health history…",
  currentQuestion: {
    id: "abdominal_pain.location",
    category: "HPI",
    text: "Where do you feel it?",
    inputType: "CHOICE",
    options: ["Upper abdomen", "Lower abdomen", "Not sure"],
    required: true,
    priority: 100,
  },
  state: {
    pathway: "abdominal_pain",
    facts: {},
    unknownFields: [],
    conflicts: [],
  },
  responses: [],
  startedAt: new Date(0).toISOString(),
};

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/hooks/use-session-guard", () => ({
  useSessionGuard: () => ({
    state: {
      hydrated: mocks.hydrated,
      sessionId: interview.sessionId,
      sessionToken: "proof",
      visitId: interview.visitId,
      interviewId: null,
      pendingQuestionId: null,
      complaint: "Stomach pain for three days",
      language: "en",
    },
    sessionReady: mocks.sessionReady,
    setInterviewId: mocks.setInterviewId,
    setAnswer: mocks.setAnswer,
    setPendingQuestionId: mocks.setPendingQuestionId,
    saveInterview: mocks.saveInterview,
  }),
}));
vi.mock("@/services/interview-service", () => ({
  interviewService: {
    create: mocks.create,
    get: mocks.get,
    respond: mocks.respond,
    confirm: mocks.confirm,
    complete: mocks.complete,
    revise: mocks.revise,
  },
}));

describe("adaptive interview page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hydrated = true;
    mocks.sessionReady = true;
    sessionStorage.clear();
    mocks.create.mockResolvedValue(interview);
  });

  it("initializes after a refreshed page restores its session", async () => {
    mocks.hydrated = false;
    const { rerender } = render(<InterviewPage />);
    expect(mocks.create).not.toHaveBeenCalled();
    mocks.hydrated = true;
    rerender(<InterviewPage />);
    expect(
      await screen.findByRole("heading", { name: "Where do you feel it?" }),
    ).toBeInTheDocument();
    expect(mocks.create).toHaveBeenCalledOnce();
  });

  it("waits for signed-session validation before creating an interview", async () => {
    mocks.sessionReady = false;
    const { rerender } = render(<InterviewPage />);
    expect(mocks.create).not.toHaveBeenCalled();
    mocks.sessionReady = true;
    rerender(<InterviewPage />);
    expect(
      await screen.findByRole("heading", { name: "Where do you feel it?" }),
    ).toBeInTheDocument();
    expect(mocks.create).toHaveBeenCalledOnce();
  });

  it("retries only the failed initialization request", async () => {
    mocks.create
      .mockRejectedValueOnce(new Error("temporary outage"))
      .mockResolvedValueOnce(interview);
    render(<InterviewPage />);
    await screen.findByRole("heading", { name: "We couldn’t load the interview" });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("heading", { name: "Where do you feel it?" }),
    ).toBeInTheDocument();
    expect(mocks.create).toHaveBeenCalledTimes(2);
  });

  it("clears positive symptoms when None of these is selected", async () => {
    mocks.create.mockResolvedValue({
      ...interview,
      currentQuestion: {
        ...interview.currentQuestion,
        inputType: "MULTI_SELECT",
        options: ["Fever", "None of these", "Not sure"],
      },
    });
    render(<InterviewPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Type instead" }));
    const fever = await screen.findByRole("button", { name: "Fever" });
    fireEvent.click(fever);
    fireEvent.click(screen.getByRole("button", { name: "None of these" }));
    expect(fever).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", { name: "None of these" }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(fever);
    expect(
      screen.getByRole("button", { name: "None of these" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("renders one server-selected question and submits a choice", async () => {
    const preview: InterviewResponsePreviewDto = {
      interview,
      response: {
        id: "cm523456789012345678901234",
        questionId: "abdominal_pain.location",
        rawAnswer: "Upper abdomen",
        normalizedAnswer: {
          field: "location",
          value: "Upper abdomen",
          state: "YES",
        },
        language: "en",
        source: "PATIENT_REPORTED",
        confidenceBand: "HIGH",
        status: "STRUCTURED",
        createdAt: new Date(0).toISOString(),
      },
      needsConfirmation: true,
    };
    mocks.respond.mockResolvedValue(preview);
    render(<InterviewPage />);
    expect(
      await screen.findByRole("heading", { name: "Where do you feel it?" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Type instead" }));
    fireEvent.click(screen.getByRole("button", { name: "Upper abdomen" }));
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(await screen.findByText("Is this correct?")).toBeInTheDocument();
    expect(mocks.respond).toHaveBeenCalledWith(
      interview.id,
      expect.objectContaining({ rawAnswer: "Upper abdomen" }),
      "proof",
    );
  });

  it("only advances after the patient confirms the normalized preview", async () => {
    const preview = {
      interview,
      response: {
        id: "cm523456789012345678901234",
        questionId: "abdominal_pain.location",
        rawAnswer: "Upper abdomen",
        normalizedAnswer: { value: "Upper abdomen" },
        language: "en",
        source: "PATIENT_REPORTED",
        confidenceBand: "HIGH",
        status: "STRUCTURED",
        createdAt: new Date(0).toISOString(),
      },
      needsConfirmation: true,
    } satisfies InterviewResponsePreviewDto;
    mocks.respond.mockResolvedValue(preview);
    mocks.confirm.mockResolvedValue({
      ...interview,
      completeness: 75,
      currentQuestion: {
        ...interview.currentQuestion!,
        id: "abdominal_pain.severity",
        text: "How strong is it?",
        inputType: "SLIDER",
      },
    });
    render(<InterviewPage />);
    await screen.findByText("Where do you feel it?");
    fireEvent.click(screen.getByRole("button", { name: "Type instead" }));
    fireEvent.click(screen.getByRole("button", { name: "Upper abdomen" }));
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    fireEvent.click(
      await screen.findByRole("button", { name: /Sounds right/ }),
    );
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledOnce());
    expect(
      await screen.findByRole("slider", { name: "Severity from 0 to 10" }),
    ).toBeInTheDocument();
  });

  it("does not silently submit a default pain severity", async () => {
    mocks.create.mockResolvedValue({
      ...interview,
      currentQuestion: {
        ...interview.currentQuestion!,
        id: "abdominal_pain.severity",
        text: "How strong is it?",
        inputType: "SLIDER",
      },
    });
    render(<InterviewPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Type instead" }));
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review" })).toBeDisabled();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "7" } });
    expect(screen.getByRole("button", { name: "Review" })).toBeEnabled();
  });
});
