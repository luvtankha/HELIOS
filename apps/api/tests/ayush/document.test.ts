import { describe, expect, it } from "vitest";
import { RuleBasedMedicalEntityExtractor } from "../../src/document-ai/providers.js";

describe("AYUSH document extraction", () => {
  const extractor = new RuleBasedMedicalEntityExtractor();

  it("extracts a source-linked AYUSH fact without ingredient inference", () => {
    const facts = extractor.extract(
      [
        {
          pageNumber: 2,
          text: "Ayurvedic medicine: documented formulation",
          blocks: [
            {
              text: "Ayurvedic medicine: documented formulation",
              boundingBox: { x: 1, y: 2, width: 3, height: 4 },
            },
          ],
          confidence: 0.91,
        },
      ],
      "PRESCRIPTION",
    );
    const fact = facts.find((item) => item.factType === "ayush_treatment");
    expect(fact).toMatchObject({
      pageNumber: 2,
      normalizedValue: {
        system: "AYURVEDA",
        medicineName: "documented formulation",
        ingredients: "NOT_DOCUMENTED",
      },
    });
    expect(fact?.boundingBox).toBeDefined();
  });

  it("records an unspecified medicine instead of guessing", () => {
    const [fact] = extractor.extract(
      [{ pageNumber: 1, text: "Unani treatment", blocks: [], confidence: 0.8 }],
      "CONSULTATION_NOTE",
    );
    expect(fact?.normalizedValue).toMatchObject({
      system: "UNANI",
      originalName: "NOT_SPECIFIED",
    });
  });

  it("does not classify an unrelated medication as AYUSH", () => {
    const facts = extractor.extract(
      [
        {
          pageNumber: 1,
          text: "Tab Metformin 500 mg twice daily",
          blocks: [],
          confidence: 0.9,
        },
      ],
      "PRESCRIPTION",
    );
    expect(facts.some((item) => item.factType === "ayush_treatment")).toBe(
      false,
    );
  });
});
