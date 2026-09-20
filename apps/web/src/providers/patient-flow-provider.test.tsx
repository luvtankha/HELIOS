import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PatientSessionDto } from "@helios/shared";
import { PatientFlowProvider, usePatientFlow } from "./patient-flow-provider";
import { patientApi } from "@/services/patient-flow";

vi.mock("@/services/patient-flow", () => ({
  patientApi: {
    createSession: vi.fn(),
    getSession: vi.fn(),
    updateProgress: vi.fn(),
    submit: vi.fn(),
  },
}));
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <PatientFlowProvider>{children}</PatientFlowProvider>
);
function session(id = "existing") {
  return {
    id,
    sessionToken: "proof",
    currentStep: "REVIEW",
    language: "en",
    visit: { id: "visit", chiefComplaint: "Previous saved concern" },
  } as PatientSessionDto;
}
describe("patient session recovery", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    localStorage.setItem(
      "helios.patient.session.v1",
      JSON.stringify({
        sessionId: "existing",
        currentStep: "REVIEW",
        interviewId: "interview",
      }),
    );
    sessionStorage.setItem("helios.patient.token.v1", "proof");
    sessionStorage.setItem(
      "helios.patient.draft.v1",
      JSON.stringify({
        complaint: "Newly edited concern",
        details: {
          fullName: "Synthetic Patient",
          age: "30",
          sex: "MALE",
          phone: "",
        },
      }),
    );
  });
  it.each(["null", "[]", '{"details":null,"complaint":42,"answers":false}'])(
    "ignores malformed saved drafts: %s",
    async (draft) => {
      sessionStorage.setItem("helios.patient.draft.v1", draft);
      const { result } = renderHook(usePatientFlow, { wrapper });
      await waitFor(() => expect(result.current.state.hydrated).toBe(true));
      expect(result.current.state.details.fullName).toBe("");
      expect(result.current.state.complaint).toBe("");
      expect(result.current.state.answers).toEqual({});
    },
  );
  it("keeps unsaved complaint edits when navigating or resuming", async () => {
    vi.mocked(patientApi.getSession).mockResolvedValue(session());
    const { result } = renderHook(usePatientFlow, { wrapper });
    await waitFor(() => expect(result.current.state.hydrated).toBe(true));
    await act(async () => {
      await result.current.resume();
    });
    expect(result.current.state.complaint).toBe("Newly edited concern");
  });
  it("clears prior patient data when starting a different session", async () => {
    vi.mocked(patientApi.createSession).mockResolvedValue({
      id: "new",
      sessionToken: "new-proof",
      currentStep: "LANGUAGE",
      language: "en",
    } as PatientSessionDto);
    const { result } = renderHook(usePatientFlow, { wrapper });
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.state.details.fullName).toBe("");
    expect(result.current.state.complaint).toBe("");
    expect(result.current.state.interviewId).toBeNull();
  });
  it("keeps the review step if submission fails", async () => {
    vi.mocked(patientApi.submit).mockRejectedValue(new Error("offline"));
    const { result } = renderHook(usePatientFlow, { wrapper });
    await act(async () => {
      await expect(result.current.submit()).rejects.toThrow("offline");
    });
    expect(result.current.state.currentStep).toBe("REVIEW");
    expect(result.current.state.complaint).toBe("Newly edited concern");
  });
  it("moves a completed rich interview to review without a legacy overwrite", async () => {
    vi.mocked(patientApi.updateProgress).mockResolvedValue(session());
    const { result } = renderHook(usePatientFlow, { wrapper });
    await waitFor(() => expect(result.current.state.hydrated).toBe(true));
    await act(async () => {
      result.current.setAnswer("diabetesProblem", "No");
      result.current.setAnswer("severity", "4");
    });
    await act(async () => {
      await result.current.saveInterview();
    });
    expect(patientApi.updateProgress).toHaveBeenCalledWith(
      "existing",
      { currentStep: "REVIEW" },
      "proof",
    );
  });
});
