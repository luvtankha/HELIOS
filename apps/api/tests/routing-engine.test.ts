import { describe, expect, it } from "vitest";
import { routingDataset } from "../src/routing/routing-dataset.js";
import { matches, routeSpecialization } from "../src/routing/routing-engine.js";

const route = (complaint: string, extra: Parameters<typeof routeSpecialization>[0] = {}) =>
  routeSpecialization({ complaint, ...extra }, routingDataset.mappings, routingDataset.emergencyRules, routingDataset.version);

describe("deterministic specialty routing", () => {
  it.each([
    ["fractured wrist after a fall", "orthopaedics"],
    ["itchy red rash for several days", "dermatology"],
    ["persistent migraine with aura", "neurology"],
    ["kidney stone", "urology"],
    ["known chronic kidney disease", "nephrology"],
    ["thyroid problem", "endocrinology"],
    ["ear pain and hearing problem", "ent"],
    ["blurred vision and eye irritation", "ophthalmology"],
    ["tooth pain and gum bleeding", "dentistry"],
    ["I feel weak and unwell", "internal-medicine"],
  ])("routes %s to %s", (complaint, specialization) => {
    const result = route(complaint);
    expect(result.primarySpecialization).toBe(specialization);
    expect(result.emergencyEscalation).toBe(false);
    expect(result.reason).toMatch(/not|reported|generally|starting/i);
  });

  it("uses aliases, singular/plural normalization and one-character fuzzy spelling", () => {
    expect(route("my arm broke").primarySpecialization).toBe("orthopaedics");
    expect(route("fracturd wrist after fall").primarySpecialization).toBe("orthopaedics");
    expect(matches("red rashes everywhere", "rash")).toBe(true);
  });

  it("keeps known kidney disease primary while retaining endocrine relevance", () => {
    const result = route("diabetes follow-up", { knownConditions: ["known chronic kidney disease", "diabetes"] });
    expect(result.primarySpecialization).toBe("nephrology");
    expect(result.alternativeSpecializations).toContain("endocrinology");
  });

  it("uses a child-focused starting point when a non-surgical specialist pattern applies", () => {
    const result = route("itchy red rash for several days", { age: 8 });
    expect(result.primarySpecialization).toBe("pediatrics");
    expect(result.alternativeSpecializations).toContain("dermatology");
  });

  it("does not turn explicit negation or historic symptoms into emergency escalation", () => {
    expect(route("I do not have chest pain, just need a refill").emergencyEscalation).toBe(false);
    expect(route("My father had crushing chest pain years ago; I have a skin rash").emergencyEscalation).toBe(false);
  });

  it("lets the emergency rule override specialty selection", () => {
    const result = route("severe crushing chest pain with sweating and difficulty breathing");
    expect(result).toMatchObject({ primarySpecialization: "emergency-medicine", urgency: "emergency", emergencyEscalation: true });
    expect(result.emergencyRuleIds.length).toBeGreaterThan(0);
  });

  it("honours a pre-existing high-risk signal without making a diagnosis", () => {
    const result = route("a rash", { clinicalContext: { currentEmergencySignal: true } });
    expect(result.emergencyRuleIds).toContain("existing-high-risk-signal");
    expect(result.reason).not.toMatch(/you have/i);
  });

  it("falls back conservatively for vague, unknown and competing requests", () => {
    expect(route("I do not feel well").confidenceBand).toBe("low");
    expect(route("I do not feel well").primarySpecialization).toBe("internal-medicine");
    const competing = route("persistent headache with a skin rash");
    expect(["internal-medicine", "neurology", "dermatology"]).toContain(competing.primarySpecialization);
    expect(competing.confidenceMeaning).toBe("heuristic_match_not_probability");
  });
});
