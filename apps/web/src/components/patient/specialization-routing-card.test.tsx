import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SpecializationRoutingCard } from "./specialization-routing-card";

const mocks = vi.hoisted(() => ({ assess: vi.fn(), providers: vi.fn(), select: vi.fn() }));
vi.mock("@/services/specialization-routing", () => ({ specializationRoutingApi: mocks }));
const assessment = {
  decisionId: "routing-1", createdAt: new Date(0).toISOString(), selectedProviderId: null, reviewStatus: "CLINICIAN_REVIEW_REQUIRED" as const,
  specializations: [{ id: "neurology", displayName: "Neurology", providerType: "physician" }, { id: "internal-medicine", displayName: "General Medicine / Internal Medicine", providerType: "physician" }],
  recommendation: { primarySpecialization: "neurology", alternativeSpecializations: ["internal-medicine"], confidence: 0.72, confidenceBand: "medium" as const, confidenceMeaning: "heuristic_match_not_probability" as const, urgency: "soon" as const, emergencyEscalation: false, matchedConditions: ["migraine"], matchedSymptoms: ["headache"], emergencyRuleIds: [], reason: "This department generally evaluates this type of problem.", limitations: "Routing support, not a diagnosis.", version: "test" },
};
describe("specialization routing card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assess.mockResolvedValue(assessment);
    mocks.providers.mockResolvedValue({ providers: [{ id: "doctor-1", displayName: "Dr. Meera", acceptingRouting: true, specialization: assessment.specializations[0] }], specializationId: "neurology", availabilityNote: "Not a booking." });
    mocks.select.mockResolvedValue({ selectedProviderId: "doctor-1" });
  });
  it("shows a conservative recommendation, alternatives, filters and provider selection", async () => {
    render(<SpecializationRoutingCard sessionToken="proof" />);
    expect(await screen.findByRole("heading", { name: "Neurology" })).toBeInTheDocument();
    expect(screen.getByText(/Other potentially relevant departments/i)).toHaveTextContent("General Medicine");
    await waitFor(() => expect(mocks.providers).toHaveBeenCalledWith("proof", "neurology"));
    fireEvent.click(screen.getByRole("button", { name: "Choose doctor" }));
    await waitFor(() => expect(mocks.select).toHaveBeenCalledWith("proof", "doctor-1"));
    fireEvent.change(screen.getByLabelText("Department"), { target: { value: "internal-medicine" } });
    await waitFor(() => expect(mocks.providers).toHaveBeenCalledWith("proof", "internal-medicine"));
  });
  it("replaces ordinary choice with an emergency pathway", async () => {
    mocks.assess.mockResolvedValue({ ...assessment, recommendation: { ...assessment.recommendation, emergencyEscalation: true, urgency: "emergency", primarySpecialization: "emergency-medicine", reason: "Emergency medical evaluation recommended." } });
    render(<SpecializationRoutingCard sessionToken="proof" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Please do not wait for a routine appointment");
    expect(mocks.providers).not.toHaveBeenCalled();
  });
});
