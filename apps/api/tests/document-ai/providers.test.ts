import { describe, expect, it } from "vitest";
import {
  HeuristicDocumentClassifier,
  MockOCRProvider,
  RuleBasedMedicalEntityExtractor,
} from "../../src/document-ai/providers.js";
import type { OcrPage } from "../../src/document-ai/types.js";

function page(text: string, confidence = 0.98): OcrPage {
  return {
    pageNumber: 1,
    text,
    blocks: [
      { text, confidence, boundingBox: { x: 1, y: 2, width: 3, height: 4 } },
    ],
    confidence,
  };
}

describe("document classification", () => {
  const classifier = new HeuristicDocumentClassifier();

  it.each([
    ["Prescription Rx tablet twice daily", "PRESCRIPTION"],
    ["Laboratory report Hemoglobin 9.2 g/dL reference range", "LAB_REPORT"],
    ["Discharge summary admission date discharge date", "DISCHARGE_SUMMARY"],
    ["Consultation note chief complaint investigations", "CONSULTATION_NOTE"],
  ])("classifies explicit %s text", (text, expected) => {
    expect(classifier.classify([page(text)]).type).toBe(expected);
  });

  it("returns UNKNOWN instead of forcing an unsupported image", () => {
    expect(classifier.classify([page("Government identity card")]).type).toBe(
      "UNKNOWN",
    );
  });
});

describe("medical entity extraction", () => {
  const extractor = new RuleBasedMedicalEntityExtractor();

  it("extracts and normalizes only explicit prescription fields", () => {
    const facts = extractor.extract(
      [page("Tab Metformin 500 mg, take one tablet twice daily after food")],
      "PRESCRIPTION",
    );
    expect(facts).toEqual([
      expect.objectContaining({
        factType: "medication",
        originalValue: expect.stringContaining("Metformin 500 mg"),
        normalizedValue: {
          name: "Metformin",
          dose: 500,
          unit: "mg",
          frequency: "twice daily",
          timing: "after food",
          route: "UNKNOWN",
          historyStatus: "HISTORICAL",
        },
        pageNumber: 1,
        boundingBox: { x: 1, y: 2, width: 3, height: 4 },
      }),
    ]);
  });

  it("extracts a lab value without inventing anemia or an absent allergy", () => {
    const facts = extractor.extract(
      [page("Hemoglobin 9.2 g/dL 12-16 LOW")],
      "LAB_REPORT",
    );
    expect(facts[0]?.normalizedValue).toEqual({
      testName: "Hemoglobin",
      result: 9.2,
      unit: "g/dL",
      referenceRange: "12–16",
      abnormalFlag: "LOW",
    });
    expect(facts.some((fact) => fact.factType === "documented_diagnosis")).toBe(
      false,
    );
    expect(facts.some((fact) => fact.factType === "allergy")).toBe(false);
  });

  it("preserves OCR spelling evidence and lowers uncertain medication confidence", () => {
    const facts = extractor.extract(
      [page("Tab Metfornin 500 mg", 0.61)],
      "PRESCRIPTION",
    );
    expect(facts[0]).toEqual(
      expect.objectContaining({
        originalValue: "Tab Metfornin 500 mg",
        confidence: 0.61,
        normalizedValue: expect.objectContaining({ name: "Metfornin" }),
      }),
    );
  });

  it("extracts no clinical facts for an unknown document", () => {
    expect(extractor.extract([page("Identity card 123")], "UNKNOWN")).toEqual(
      [],
    );
  });

  it("extracts an explicitly documented allergy but never infers none", () => {
    expect(
      extractor.extract([page("Allergy: Penicillin")], "DISCHARGE_SUMMARY")[0],
    ).toEqual(
      expect.objectContaining({
        factType: "allergy",
        normalizedValue: { allergen: "Penicillin" },
      }),
    );
    expect(
      extractor.extract([page("No allergy section")], "DISCHARGE_SUMMARY"),
    ).toEqual([]);
  });
});

describe("mock OCR", () => {
  it("returns page-level text, layout and confidence for reliable demo mode", async () => {
    const pages = await new MockOCRProvider().recognize({
      buffer: Buffer.from("synthetic"),
      mimeType: "image/png",
      fileName: "lab-report.png",
    });
    expect(pages).toHaveLength(1);
    expect(pages[0]?.text).toContain("Hemoglobin 9.2 g/dL");
    expect(pages[0]?.blocks[0]?.boundingBox).toBeDefined();
  });
});
