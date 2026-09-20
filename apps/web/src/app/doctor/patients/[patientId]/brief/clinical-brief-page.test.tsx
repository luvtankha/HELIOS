import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ClinicalBriefPage from "./page";

const { quick, refresh, review } = vi.hoisted(() => ({
  quick: vi.fn(),
  refresh: vi.fn(),
  review: vi.fn(),
}));
const { session } = vi.hoisted(() => ({
  session: {
    doctorId: "doctor",
    displayName: "Dr Synthetic",
    role: "DOCTOR",
    doctorToken: "signed",
  },
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ patientId: "patient" }),
}));
vi.mock("@/services/clinical-brief", () => ({
  clinicalBriefApi: { quick, refresh, review },
}));
vi.mock("@/providers/doctor-auth-provider", () => ({
  useDoctorAuth: () => ({ session, hydrated: true }),
}));

const claim = {
  id: "claim",
  claimKey: "reason",
  sectionType: "TODAYS_REASON",
  text: "Stomach pain for 3 days with vomiting.",
  structuredValue: { duration: "3 days" },
  sourceType: "PATIENT_REPORTED",
  sourceId: "history",
  verificationStatus: "CAPTURED",
  confidenceBand: "UNKNOWN",
  needsVerification: false,
  evidence: [
    {
      kind: "INTERVIEW",
      sourceId: "history",
      label: "Patient reported",
      sourceText: "Stomach pain for 3 days with vomiting.",
    },
  ],
} as const;
const brief = {
  id: "brief",
  patientId: "patient",
  patientName: "Aarav Sharma",
  patientCode: "SYNTHETIC",
  age: 24,
  sex: "MALE",
  preferredLanguage: "hi",
  visitId: "visit",
  visitDate: "2026-09-09T00:00:00Z",
  status: "GENERATED",
  version: 1,
  generatorVersion: "phase9-v1",
  generatedAt: "2026-09-09T00:00:00Z",
  narrative: claim.text,
  claimCount: 2,
  sections: [
    {
      sectionType: "TODAYS_REASON",
      title: "Why today?",
      availability: "AVAILABLE",
      collapsible: false,
      defaultExpanded: true,
      claims: [claim],
    },
    {
      sectionType: "SAFETY_ATTENTION",
      title: "Safety attention",
      availability: "UNAVAILABLE",
      collapsible: false,
      defaultExpanded: true,
      claims: [],
    },
  ],
} as const;

describe("doctor clinical brief page", () => {
  beforeEach(() => {
    quick.mockResolvedValue(brief);
    refresh.mockResolvedValue({ ...brief, version: 2 });
    review.mockResolvedValue({ ...brief, status: "REVIEWED" });
  });
  it("shows concise provenance, unavailable dependencies, and evidence", async () => {
    render(<ClinicalBriefPage />);
    expect(await screen.findByText("Aarav Sharma")).toBeInTheDocument();
    expect(quick).toHaveBeenCalledWith("patient", "signed");
    expect(
      screen.getByText("Stomach pain for 3 days with vomiting."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Safety attention status unavailable."),
    ).toBeInTheDocument();
    expect(screen.getByText(/does not diagnose/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Evidence" }));
    expect(
      screen.getByRole("dialog", { name: "Claim evidence" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Patient reported")).toHaveLength(2);
  });
  it("offers refresh and review without treatment actions", async () => {
    render(<ClinicalBriefPage />);
    await screen.findByText("Aarav Sharma");
    fireEvent.click(screen.getByRole("button", { name: "Refresh brief" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    fireEvent.click(
      await screen.findByRole("button", { name: "Mark reviewed" }),
    );
    await waitFor(() => expect(review).toHaveBeenCalledTimes(1));
    expect(
      screen.queryByRole("button", { name: /prescribe|treat|order test/i }),
    ).not.toBeInTheDocument();
  });
});
