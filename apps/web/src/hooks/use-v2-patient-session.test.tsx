import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useV2PatientSession } from "./use-v2-patient-session";
import type { V2PatientSession } from "@/services/patient-v2";

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  getSession: vi.fn(),
  recordPreConsultationConsent: vi.fn(),
}));

vi.mock("@/services/patient-v2", async () => {
  const actual = await vi.importActual<typeof import("@/services/patient-v2")>(
    "@/services/patient-v2",
  );
  return {
    ...actual,
    patientV2Service: {
      ...actual.patientV2Service,
      createSession: mocks.createSession,
      getSession: mocks.getSession,
      recordPreConsultationConsent: mocks.recordPreConsultationConsent,
    },
  };
});

const createdSession: V2PatientSession = {
  sessionId: "c123456789012345678901234",
  sessionToken: "synthetic-proof",
  status: "STARTED",
  currentStep: "CONSENT",
  conversationLanguage: "hi-Hinglish",
  patientId: null,
  visitId: null,
  startedAt: "2026-10-04T00:00:00Z",
};

describe("useV2PatientSession", () => {
  afterEach(() => vi.restoreAllMocks());
  beforeEach(() => {
    sessionStorage.clear();
    mocks.createSession.mockReset();
    mocks.getSession.mockReset();
    mocks.recordPreConsultationConsent.mockReset();
    mocks.createSession.mockResolvedValue(createdSession);
    mocks.recordPreConsultationConsent.mockResolvedValue({
      consentId: "c323456789012345678901234",
      accepted: true,
    });
    mocks.getSession.mockResolvedValue({
      ...createdSession,
      sessionToken: null,
      currentStep: "BASIC_INFO",
    });
  });

  it("saves explicit consent and refreshes the session before voice can start", async () => {
    const { result } = renderHook(() => useV2PatientSession());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    await act(async () => {
      await result.current.acceptConsent();
    });

    expect(mocks.recordPreConsultationConsent).toHaveBeenCalledWith(
      createdSession,
    );
    expect(mocks.getSession).toHaveBeenCalledWith(
      createdSession.sessionId,
      createdSession.sessionToken,
    );
    expect(result.current.status).toBe("ready");
    expect(result.current.session?.currentStep).toBe("BASIC_INFO");
    expect(result.current.session?.sessionToken).toBe(createdSession.sessionToken);
  });

  it("coalesces rapid consent clicks into one write", async () => {
    let save!: () => void;
    mocks.recordPreConsultationConsent.mockImplementation(() => new Promise<void>((resolve) => { save = resolve; }));
    const { result } = renderHook(() => useV2PatientSession());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    await act(async () => {
      const first = result.current.acceptConsent();
      const second = result.current.acceptConsent();
      save();
      await Promise.all([first, second]);
    });
    expect(mocks.recordPreConsultationConsent).toHaveBeenCalledTimes(1);
  });

  it("allows a consent retry after a network error", async () => {
    mocks.recordPreConsultationConsent.mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() => useV2PatientSession());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    await act(() => result.current.acceptConsent());
    expect(result.current.consentStatus).toBe("error");
    await act(() => result.current.acceptConsent());
    expect(result.current.session?.currentStep).toBe("BASIC_INFO");
  });

  it("continues in memory when browser storage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("storage disabled", "SecurityError");
    });
    const { result } = renderHook(() => useV2PatientSession());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.session?.sessionId).toBe(createdSession.sessionId);
  });

  it("ignores malformed persisted session proofs", async () => {
    sessionStorage.setItem("helios:v2:patient-session", JSON.stringify({ sessionId: {}, sessionToken: 42 }));
    const { result } = renderHook(() => useV2PatientSession());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.createSession).toHaveBeenCalledTimes(1);
  });
});
