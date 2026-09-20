import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConsentPage from "./consent/page";
import DetailsPage from "./details/page";
import LanguagePage from "./language/page";
import ListeningPage from "./listening/page";
import PatientWelcomePage from "./page";
import ReviewPage from "./review/page";
import { PatientFlowProvider } from "@/providers/patient-flow-provider";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  chooseLanguage: vi.fn(async () => undefined),
  acceptConsent: vi.fn(async () => undefined),
  saveDetails: vi.fn(async () => undefined),
  submit: vi.fn(async () => undefined),
  setDetails: vi.fn(),
  setComplaint: vi.fn(),
  setAnswer: vi.fn(),
  saveInterview: vi.fn(async () => undefined),
  reset: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
}));

const guardedFlow = {
  state: {
    hydrated: true,
    sessionId: "cm123456789012345678901234",
    sessionToken: "synthetic-session-proof",
    patientId: "cm223456789012345678901234",
    visitId: "cm323456789012345678901234",
    currentStep: "REVIEW" as const,
    language: "en" as const,
    details: {
      fullName: "Aarav Sharma",
      age: "24",
      sex: "MALE" as const,
      phone: "",
    },
    complaint:
      "I have had stomach pain for three days and I feel like vomiting.",
    answers: {
      location: "Upper abdomen",
      duration: "Three days",
      vomiting: "Yes",
    },
    tokenNumber: "A-127",
    submittedAt: null,
  },
  ...mocks,
  start: vi.fn(),
  resume: vi.fn(),
};

vi.mock("@/hooks/use-session-guard", () => ({
  useSessionGuard: () => guardedFlow,
}));

describe("patient experience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("renders the patient welcome screen", () => {
    render(
      <PatientFlowProvider>
        <PatientWelcomePage />
      </PatientFlowProvider>,
    );
    expect(
      screen.getByRole("heading", { name: "Tell us how you’re feeling." }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start check-in" }),
    ).toBeInTheDocument();
  });

  it("selects and persists Hindi before navigating", async () => {
    render(<LanguagePage />);
    fireEvent.click(screen.getByRole("button", { name: /हिन्दी Hindi/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() =>
      expect(mocks.chooseLanguage).toHaveBeenCalledWith("hi"),
    );
    expect(mocks.push).toHaveBeenCalledWith("/patient/review");
  });

  it("requires explicit consent", () => {
    render(<ConsentPage />);
    const continueButton = screen.getByRole("button", {
      name: "I Understand & Continue",
    });
    expect(continueButton).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(continueButton).toBeEnabled();
  });

  it("shows friendly validation errors", () => {
    render(<DetailsPage />);
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("Age"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Please enter a valid name.")).toBeInTheDocument();
    expect(screen.getByText("Please enter your age.")).toBeInTheDocument();
  });

  it("reviews saved patient data and submits", async () => {
    render(<ReviewPage />);
    expect(screen.getByText(/Aarav Sharma/)).toBeInTheDocument();
    expect(screen.getByText(/Upper abdomen/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Submit for consultation" }),
    );
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledOnce());
    expect(mocks.push).toHaveBeenCalledWith("/patient/complete");
  });

  it("resumes a persisted session at the saved step", async () => {
    sessionStorage.setItem("helios.patient.token.v1", "valid-test-token");
    localStorage.setItem(
      "helios.patient.session.v1",
      JSON.stringify({
        sessionId: "cm123456789012345678901234",
        currentStep: "REVIEW",
        language: "en",
      }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: "cm123456789012345678901234",
            status: "READY_FOR_REVIEW",
            currentStep: "REVIEW",
            language: "en",
            lastActiveAt: new Date(0).toISOString(),
          },
        }),
      })),
    );
    render(
      <PatientFlowProvider>
        <PatientWelcomePage />
      </PatientFlowProvider>,
    );
    const resume = await screen.findByRole("button", {
      name: "Continue previous session",
    });
    await waitFor(() => expect(resume).toBeEnabled());
    fireEvent.click(resume);
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith("/patient/review"),
    );
  });

  it("keeps input safe when the API is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new Error("offline"))),
    );
    render(
      <PatientFlowProvider>
        <PatientWelcomePage />
      </PatientFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Start check-in" }));
    expect(
      await screen.findByText(/Anything you entered is still on this device/),
    ).toBeInTheDocument();
  });

  it("keeps text entry available when voice cannot be used", () => {
    const previousComplaint = guardedFlow.state.complaint;
    guardedFlow.state.complaint = "";
    render(<ListeningPage />);
    fireEvent.click(screen.getByRole("button", { name: "Type instead" }));
    expect(
      screen.getByRole("heading", { name: "Type your answer" }),
    ).toBeInTheDocument();
    guardedFlow.state.complaint = previousComplaint;
  });
});
