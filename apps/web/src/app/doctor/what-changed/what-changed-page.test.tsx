import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WhatChangedPage from "./page";

const { create, signOut, session } = vi.hoisted(() => ({
  create: vi.fn(),
  signOut: vi.fn(),
  session: {
    doctorId: "doctor",
    displayName: "Dr Synthetic",
    role: "DOCTOR",
    doctorToken: "signed",
  },
}));
vi.mock("@/services/comparisons", () => ({
  comparisonApi: {
    patients: vi.fn(async () => [
      {
        id: "patient",
        patientCode: "SYNTHETIC",
        fullName: "Aarav Sharma",
        visits: [
          {
            id: "current",
            startedAt: "2026-09-01T00:00:00Z",
            status: "READY_FOR_DOCTOR",
          },
          {
            id: "previous",
            startedAt: "2026-05-10T00:00:00Z",
            status: "COMPLETED",
          },
        ],
      },
    ]),
    create,
  },
}));
vi.mock("@/providers/doctor-auth-provider", () => ({
  useDoctorAuth: () => ({ session, signOut, hydrated: true }),
}));

const summary = {
  newCount: 0,
  changedCount: 1,
  removedCount: 0,
  conflictCount: 0,
  unknownCount: 0,
  unchangedCount: 1,
  newlyCapturedCount: 0,
  notComparableCount: 0,
  needsReviewCount: 0,
};
const changes = [
  {
    id: "changed",
    entityType: "OBSERVATION",
    entityKey: "hemoglobin",
    changeType: "CHANGED",
    reason: "NORMALIZED_VALUE_CHANGED",
    fieldChanges: [
      {
        field: "value",
        previous: 10.4,
        current: 8.9,
        unit: "g/dl",
        absoluteDelta: -1.5,
      },
    ],
    previousValue: { value: 10.4 },
    currentValue: { value: 8.9 },
    previousEvidence: {
      timelineEventId: "p",
      source: "DOCUMENT_EXTRACTED",
      verificationStatus: "PATIENT_CONFIRMED",
      pageNumber: 1,
      sourceText: "Hemoglobin 10.4 g/dL",
    },
    matchConfidence: "HIGH",
    needsReview: false,
    explanation:
      "Hemoglobin has a different recorded value in the current visit.",
  },
  {
    id: "same",
    entityType: "MEDICATION",
    entityKey: "vitamin",
    changeType: "UNCHANGED",
    reason: "SAME_NORMALIZED_VALUE",
    fieldChanges: [],
    matchConfidence: "HIGH",
    needsReview: false,
    explanation: "Vitamin has the same normalized value in both visits.",
  },
];

describe("doctor What changed workspace", () => {
  beforeEach(() => {
    signOut.mockReset();
    create.mockResolvedValue({
      id: "comparison",
      patientId: "patient",
      patientName: "Aarav Sharma",
      previousVisitId: "previous",
      currentVisitId: "current",
      previousVisitDate: "2026-05-10T00:00:00Z",
      currentVisitDate: "2026-09-01T00:00:00Z",
      previousSnapshotId: "one",
      currentSnapshotId: "two",
      status: "GENERATED",
      engineVersion: "phase8-v1",
      createdAt: "2026-09-09T00:00:00Z",
      summary,
      changes,
    });
  });

  it("compares visits, hides unchanged by default, and opens evidence", async () => {
    render(<WhatChangedPage />);
    expect(
      await screen.findByText("Aarav Sharma · SYNTHETIC"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Compare visits" }));
    expect(await screen.findByText("hemoglobin")).toBeInTheDocument();
    expect(screen.queryByText("vitamin")).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /Details & evidence/i }),
    );
    expect(
      screen.getByRole("dialog", { name: "Change evidence" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Hemoglobin 10.4 g/dL")).toBeInTheDocument();
    expect(screen.getByText(/does not infer diagnosis/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        "patient",
        "previous",
        "current",
        "signed",
      ),
    );
  });

  it("uses the shared doctor session to sign out", async () => {
    render(<WhatChangedPage />);
    await screen.findByText("Aarav Sharma · SYNTHETIC");
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(signOut).toHaveBeenCalledOnce();
  });
});
