import { describe, expect, it } from "vitest";
import { RuleBasedMedicalEntityExtractor } from "../../src/document-ai/providers.js";
import type { OcrPage } from "../../src/document-ai/types.js";

const cases = [
  {
    type: "PRESCRIPTION" as const,
    text: "Tab Metformin 500 mg twice daily",
    expected: ["medication"],
  },
  {
    type: "LAB_REPORT" as const,
    text: "Hemoglobin 9.2 g/dL 12-16 LOW",
    expected: ["lab_result"],
  },
  {
    type: "DISCHARGE_SUMMARY" as const,
    text: "Admission date: 2026-08-20\nDischarge date: 2026-08-22\nDiagnosis: Synthetic documented condition\nMedication: Metformin 500 mg twice daily",
    expected: [
      "admission_date",
      "discharge_date",
      "documented_diagnosis",
      "medication",
    ],
  },
  {
    type: "CONSULTATION_NOTE" as const,
    text: "Chief complaint: abdominal pain\nAssessment: documented gastritis\nHemoglobin 10.4 g/dL",
    expected: ["chief_complaint", "documented_diagnosis", "lab_result"],
  },
];

describe("synthetic field-level evaluation", () => {
  it("achieves exact field precision and recall on canonical synthetic cases", () => {
    const extractor = new RuleBasedMedicalEntityExtractor();
    let truePositive = 0;
    let extracted = 0;
    let expected = 0;
    for (const testCase of cases) {
      const page: OcrPage = {
        pageNumber: 1,
        text: testCase.text,
        blocks: testCase.text
          .split("\n")
          .map((text) => ({ text, confidence: 1 })),
        confidence: 1,
      };
      const actual = extractor
        .extract([page], testCase.type)
        .map((fact) => fact.factType);
      truePositive += actual.filter((field) =>
        testCase.expected.includes(field),
      ).length;
      extracted += actual.length;
      expected += testCase.expected.length;
    }
    expect({ truePositive, extracted, expected }).toEqual({
      truePositive: 9,
      extracted: 9,
      expected: 9,
    });
    expect(truePositive / extracted).toBe(1);
    expect(truePositive / expected).toBe(1);
  });
});
