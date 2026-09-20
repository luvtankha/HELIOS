import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OperationalQueue } from "./operational-queue";

const { list, callNext, act, pause, resume } = vi.hoisted(() => ({
  list: vi.fn(),
  callNext: vi.fn(),
  act: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
}));
vi.mock("@/providers/doctor-auth-provider", () => ({
  useDoctorAuth: () => ({
    session: { doctorToken: "doctor-signed", doctorId: "doctor-1" },
  }),
}));
vi.mock("@/services/queue", () => ({
  doctorQueueApi: { list, callNext, act, pause, resume },
}));

const queue = {
  queueKey: "A",
  queueDate: "2026-09-13",
  paused: false,
  entries: [
    {
      id: "priority-token",
      tokenNumber: "A-002",
      patientId: "patient-2",
      patientCode: "SYNTHETIC-2",
      patientName: "Priya Patel",
      age: 32,
      chiefComplaint: "Synthetic headache",
      status: "WAITING",
      priority: "PRIORITY_REVIEW",
      waitMinutes: 4,
      createdAt: "2026-09-13T09:00:00.000Z",
    },
    {
      id: "completed-token",
      tokenNumber: "A-001",
      patientId: "patient-1",
      patientCode: "SYNTHETIC-1",
      patientName: "Aarav Sharma",
      age: 24,
      status: "COMPLETED",
      priority: "NORMAL",
      waitMinutes: 0,
      createdAt: "2026-09-13T08:00:00.000Z",
    },
  ],
  counts: {
    waiting: 1,
    called: 0,
    inConsultation: 0,
    completed: 1,
    priorityReview: 1,
  },
  updatedAt: "2026-09-13T09:10:00.000Z",
  refreshAfterSeconds: 8,
};

describe("OperationalQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    list.mockResolvedValue(queue);
    callNext.mockResolvedValue({});
  });

  it("renders server ordering and calls next with doctor credentials", async () => {
    render(<OperationalQueue />);
    expect(await screen.findByText("Priya Patel")).toBeInTheDocument();
    expect(screen.queryByText("Aarav Sharma")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Call next" }));
    await waitFor(() => expect(callNext).toHaveBeenCalledWith("doctor-signed"));
  });

  it("filters the full queue without changing server state", async () => {
    render(<OperationalQueue full />);
    expect(await screen.findByText("Aarav Sharma")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Completed" }));
    expect(screen.getByText("Aarav Sharma")).toBeInTheDocument();
    expect(screen.queryByText("Priya Patel")).not.toBeInTheDocument();
    expect(act).not.toHaveBeenCalled();
  });
});
