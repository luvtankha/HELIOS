import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AyushCasePage from "./page";

const { session } = vi.hoisted(() => ({
  session: {
    doctorId: "doctor-1",
    displayName: "Dr Test",
    role: "DOCTOR",
    doctorToken: "signed",
  },
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ patientId: "patient-1" }),
}));
vi.mock("@/providers/doctor-auth-provider", () => ({
  useDoctorAuth: () => ({ session, hydrated: true }),
}));

describe("doctor AYUSH case page", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            patient: {
              id: "patient-1",
              fullName: "Aarav Sharma",
              patientCode: "A1",
            },
            records: [
              {
                id: "ayush-1",
                patientId: "patient-1",
                system: "AYURVEDA",
                useStatus: "CURRENT",
                originalName: "Patient wording",
                sourceType: "PATIENT_REPORTED",
                verificationStatus: "NEEDS_REVIEW",
                verificationVersion: 0,
                reportedEffect: "rash",
                temporalRelationship: "REPORTED_AFTER",
                evidence: [
                  {
                    kind: "INTERVIEW",
                    sourceId: "response-1",
                    label: "Patient interview",
                    sourceText: "I take an Ayurvedic medicine",
                  },
                ],
                createdAt: "2026-09-10T00:00:00Z",
                updatedAt: "2026-09-10T00:00:00Z",
              },
            ],
            conventionalMedications: [
              {
                id: "med-1",
                name: "Metformin",
                verificationStatus: "DOCTOR_VERIFIED",
              },
            ],
            existingSafetySignals: [],
            concurrentUseIdentified: true,
            interactionInformation: "UNAVAILABLE",
          },
        }),
      }),
    );
  });

  it("shows neutral provenance, uncertainty, and temporal wording", async () => {
    render(<AyushCasePage />);
    expect(await screen.findByText("Patient wording")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Interaction information unavailable. No interaction is inferred.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/rash was reported after treatment use/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/rash was caused/i)).not.toBeInTheDocument();
  });

  it("persists a display-language choice with the shared doctor token", async () => {
    render(<AyushCasePage />);
    await screen.findByText("Patient wording");
    fireEvent.change(screen.getByLabelText("Doctor display language"), {
      target: { value: "hi" },
    });
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/v1\/doctor\/language$/),
        expect.objectContaining({
          headers: expect.objectContaining({ "x-doctor-token": "signed" }),
        }),
      ),
    );
  });
});
