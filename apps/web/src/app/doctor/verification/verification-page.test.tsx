import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VerificationPage from "./page";

const { queue, detail, action, document, documentContent } = vi.hoisted(() => ({
  queue: vi.fn(),
  detail: vi.fn(),
  action: vi.fn(),
  document: vi.fn(),
  documentContent: vi.fn(),
}));
const { session } = vi.hoisted(() => ({
  session: {
    doctorId: "doctor",
    displayName: "Dr Meera Singh",
    role: "DOCTOR",
    doctorToken: "signed",
  },
}));
vi.mock("@/services/verification", () => ({
  verificationApi: { queue, detail, action, document, documentContent },
}));
vi.mock("@/providers/doctor-auth-provider", () => ({
  useDoctorAuth: () => ({ session, hydrated: true }),
}));

const item = {
  reviewId: "review",
  patientId: "patient",
  patientName: "Aarav Sharma",
  patientCode: "SYNTHETIC",
  visitId: "visit",
  visitDate: "2026-09-09T00:00:00Z",
  factType: "MEDICATION",
  factId: "current",
  label: "Metformin",
  value: { name: "Metformin", dose: "1000 mg", frequency: "twice daily" },
  sourceType: "PATIENT_REPORTED",
  verificationStatus: "PATIENT_REPORTED",
  version: 0,
  workflowPriority: 2,
  conflict: true,
  bulkEligible: false,
  evidenceAvailable: true,
} as const;
const review = {
  ...item,
  evidence: [
    {
      kind: "INTERVIEW",
      sourceId: "response",
      label: "Current patient interview",
      sourceText: "Main 1000 mg leta hoon.",
      language: "hi",
      normalizedValue: { dose: "1000 mg" },
    },
  ],
  previous: {
    value: { name: "Metformin", dose: "500 mg", frequency: "twice daily" },
    sourceType: "DOCUMENT_EXTRACTED",
    verificationStatus: "DOCTOR_VERIFIED",
    recordedAt: "2026-05-10T00:00:00Z",
    label: "Metformin",
  },
  history: [],
  safetySignalCount: 0,
} as const;

describe("Verification Center", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queue.mockResolvedValue({
      items: [item],
      metrics: {
        needsReview: 1,
        conflicts: 1,
        verifiedToday: 0,
        correctedToday: 0,
        rejectedToday: 0,
      },
    });
    detail.mockResolvedValue(review);
    action.mockResolvedValue({
      verification: {},
      review,
      dependentRefreshPending: false,
      message: "Verification saved and related views were refreshed.",
    });
  });

  it("ignores an older queue response after the search has changed", async () => {
    let completeOld!: (value: unknown) => void;
    queue.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          completeOld = resolve;
        }),
    );
    queue.mockResolvedValue({
      items: [{ ...item, label: "New search result" }],
      metrics: {
        needsReview: 1,
        conflicts: 0,
        verifiedToday: 0,
        correctedToday: 0,
        rejectedToday: 0,
      },
    });
    render(<VerificationPage />);
    fireEvent.change(
      screen.getByRole("textbox", { name: /Search verification queue/ }),
      { target: { value: "new" } },
    );
    expect(
      await screen.findByRole("heading", { name: "New search result" }),
    ).toBeInTheDocument();
    await act(async () => {
      completeOld({
        items: [item],
        metrics: {
          needsReview: 1,
          conflicts: 0,
          verifiedToday: 0,
          correctedToday: 0,
          rejectedToday: 0,
        },
      });
    });
    expect(
      screen.getByRole("heading", { name: "New search result" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Metformin" }),
    ).not.toBeInTheDocument();
  });

  it("corrects a native intake value without losing its explicit knowledge state", async () => {
    const live = {
      ...item,
      factType: "LIVE_INTAKE_FACT",
      label: "Onset",
      conflict: false,
      value: { value: "two days ago", knowledgeState: "KNOWN" },
    };
    queue.mockResolvedValue({
      items: [live],
      metrics: {
        needsReview: 1,
        conflicts: 0,
        verifiedToday: 0,
        correctedToday: 0,
        rejectedToday: 0,
      },
    });
    detail.mockResolvedValue({ ...review, ...live, previous: undefined });
    render(<VerificationPage />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Review evidence" }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Correct" }));
    fireEvent.change(screen.getByLabelText("Value"), {
      target: { value: "three days ago" },
    });
    fireEvent.change(screen.getByLabelText(/Reason/), {
      target: { value: "Patient clarification" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save correction" }));
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    expect(action).toHaveBeenCalledWith(
      "review",
      "CORRECT",
      expect.objectContaining({
        correctedValue: { value: "three days ago", knowledgeState: "KNOWN" },
      }),
      "signed",
    );
  });

  it("shows workflow priority, provenance, and side-by-side conflict evidence", async () => {
    render(<VerificationPage />);
    expect(await screen.findByText("Verification Center")).toBeInTheDocument();
    expect(queue).toHaveBeenCalledWith("signed", "");
    expect(screen.getByText("Aarav Sharma · SYNTHETIC")).toBeInTheDocument();
    expect(screen.getAllByText("Conflict").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Review evidence" }));
    expect(
      await screen.findByRole("dialog", { name: "Verification review" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Main 1000 mg leta hoon/)).toBeInTheDocument();
    expect(screen.getByText("Original language: hi")).toBeInTheDocument();
    expect(screen.getByText(/Dose: 500 mg/)).toBeInTheDocument();
    expect(screen.getAllByText(/Dose: 1000 mg/).length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: "Verify" }),
    ).not.toBeInTheDocument();
  });

  it("requires explicit conflict confirmation and sends authenticated action without doctorId", async () => {
    render(<VerificationPage />);
    await screen.findByText("Aarav Sharma · SYNTHETIC");
    fireEvent.click(screen.getByRole("button", { name: "Review evidence" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Confirm current" }),
    );
    expect(
      screen.getByRole("alertdialog", { name: "Confirm current confirmation" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Reason/), {
      target: { value: "Patient confirms current prescription." },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm confirm current" }),
    );
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    expect(action).toHaveBeenCalledWith(
      "review",
      "CONFIRM_CURRENT",
      expect.not.objectContaining({ doctorId: expect.anything() }),
      "signed",
    );
  });
});
