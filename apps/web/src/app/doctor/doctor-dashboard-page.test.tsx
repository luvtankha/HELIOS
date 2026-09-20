import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DoctorDashboardDto } from "@helios/shared";
import DoctorDashboardPage from "./page";

const { dashboard, session } = vi.hoisted(() => ({
  dashboard: vi.fn(),
  session: {
    doctorId: "doctor-1",
    displayName: "Dr Meera",
    role: "DOCTOR",
    doctorToken: "signed",
  },
}));
vi.mock("@/providers/doctor-auth-provider", () => ({
  useDoctorAuth: () => ({ session }),
}));
vi.mock("@/services/doctor-dashboard", () => ({
  doctorDashboardApi: { dashboard },
}));
vi.mock("@/components/doctor/operational-queue", () => ({
  OperationalQueue: () => <div>Operational queue</div>,
}));

const fixture: DoctorDashboardDto = {
  doctor: {
    id: "doctor-1",
    displayName: "Dr Meera",
    role: "DOCTOR",
    preferredLanguage: "en",
  },
  metrics: {
    patientsToday: 1,
    waiting: 0,
    pendingVerification: 2,
    highPriority: 1,
    verifiedOrCompleted: 0,
  },
  queue: [
    {
      patientId: "patient-1",
      patientCode: "SYNTHETIC-1",
      fullName: "Aarav Sharma",
      age: 24,
      sex: "MALE",
      preferredLanguage: "hi",
      visitId: "visit-1",
      visitDate: "2026-09-13T04:00:00Z",
      appointmentLabel: "Follow-up",
      tokenNumber: "A-1",
      chiefComplaint: "Synthetic stomach pain",
      status: "HIGH_PRIORITY_REVIEW",
      visitStatus: "READY_FOR_DOCTOR",
      priority: "HIGH",
      pendingVerificationCount: 2,
      openDocumentCount: 1,
      openSafetySignalCount: 1,
    },
  ],
  notifications: [],
  pagination: { page: 1, limit: 30, total: 1, totalPages: 1 },
  queueScope: "TODAY",
  demoMode: true,
};

describe("DoctorDashboardPage", () => {
  beforeEach(() => dashboard.mockReset());
  it("renders clinical metrics and the patient queue", async () => {
    dashboard.mockResolvedValue(fixture);
    render(<DoctorDashboardPage />);
    expect(screen.getByLabelText("Loading patient queue")).toBeInTheDocument();
    expect(await screen.findByText("Aarav Sharma")).toBeInTheDocument();
    expect(screen.getByText("HIGH PRIORITY REVIEW")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open workspace" }),
    ).toHaveAttribute("href", "/doctor/patients/patient-1?visitId=visit-1");
  });
  it("shows a safe error state", async () => {
    dashboard.mockRejectedValueOnce(
      new Error("Doctor access is not authorized"),
    );
    dashboard.mockResolvedValue(fixture);
    render(<DoctorDashboardPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Today’s patient information could not be loaded",
    );
  });
  it("uses debounced search", async () => {
    dashboard.mockResolvedValue(fixture);
    render(<DoctorDashboardPage />);
    await waitFor(() => expect(dashboard).toHaveBeenCalled());
    const input = screen.getByPlaceholderText(/search name/i);
    fireEvent.change(input, { target: { value: "pain" } });
    await waitFor(
      () => {
        expect(
          (dashboard.mock.calls.at(-1)?.[0] as URLSearchParams).get("search"),
        ).toBe("pain");
      },
      { timeout: 1500 },
    );
  });
});
