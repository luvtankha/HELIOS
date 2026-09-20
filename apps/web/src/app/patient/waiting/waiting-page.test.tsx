import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PatientWaitingPage from "./page";

const { status } = vi.hoisted(() => ({ status: vi.fn() }));
vi.mock("@/hooks/use-session-guard", () => ({
  useSessionGuard: () => ({ state: { sessionToken: "patient-signed" } }),
}));
vi.mock("@/services/queue", () => ({ patientQueueApi: { status } }));
vi.mock("@/components/patient/patient-shell", () => ({
  PatientShell: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe("patient waiting page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows only the authenticated patient's queue status and estimate", async () => {
    status.mockResolvedValue({
      tokenId: "token-1",
      tokenNumber: "A-014",
      status: "WAITING",
      patientsAhead: 2,
      position: 3,
      estimatedWaitMinutes: 12,
      estimateLabel: "~12 min",
      currentToken: "A-011",
      queuePaused: false,
      updatedAt: "2026-09-13T09:00:00.000Z",
      refreshAfterSeconds: 8,
    });
    render(<PatientWaitingPage />);
    expect(await screen.findByText("A-014")).toBeInTheDocument();
    expect(screen.getByText("A-011")).toBeInTheDocument();
    expect(screen.getByText("~12 min")).toBeInTheDocument();
    expect(status).toHaveBeenCalledWith("patient-signed");
    expect(screen.queryByText(/Aarav|Priya|Rohan/)).not.toBeInTheDocument();
  });

  it("shows a recoverable error without inventing queue data", async () => {
    status.mockRejectedValue(new Error("Queue temporarily unavailable"));
    render(<PatientWaitingPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Waiting status is unavailable",
    );
    expect(screen.queryByText(/A-\d+/)).not.toBeInTheDocument();
  });
});
