import type { InterviewQuestionDto } from "@helios/shared";
import { describe, expect, it, vi } from "vitest";
import {
  ClinicalNLUService,
  type AIProvider,
} from "../src/interview/clinical-nlu.js";
import type { NormalizedAnswer } from "../src/interview/interview-engine.js";

const question: InterviewQuestionDto = {
  id: "headache.location",
  category: "HPI",
  text: "Where do you feel it?",
  inputType: "TEXT",
  required: true,
  priority: 100,
};
const deterministic: NormalizedAnswer = {
  field: "location",
  value: "Front",
  state: "YES",
  confidence: "HIGH",
  source: "PATIENT_REPORTED",
};

describe("ClinicalNLUService", () => {
  it("uses deterministic rules when no provider is configured", async () => {
    const result = await new ClinicalNLUService().interpret({
      question,
      rawAnswer: "Front",
      deterministic,
    });
    expect(result.answer).toBe(deterministic);
    expect(result.validationStatus).toBe("FALLBACK");
  });

  it("retries one invalid response and accepts a valid schema response", async () => {
    const interpret = vi
      .fn<AIProvider["interpret"]>()
      .mockResolvedValueOnce({ output: { diagnosis: "migraine" } })
      .mockResolvedValueOnce({
        output: {
          field: "location",
          value: "Front",
          state: "YES",
          confidence: "HIGH",
          ambiguous: false,
        },
      });
    const provider = { id: "test", model: "test-model", interpret };
    const result = await new ClinicalNLUService(provider).interpret({
      question,
      rawAnswer: "Front",
      deterministic,
    });
    expect(interpret).toHaveBeenCalledTimes(2);
    expect(result.validationStatus).toBe("RETRY_VALID");
    expect(result.answer.source).toBe("AI_STRUCTURED");
  });

  it("falls back safely after invalid or unavailable provider output", async () => {
    const provider: AIProvider = {
      id: "test",
      interpret: vi.fn(async () => {
        throw new Error("timeout");
      }),
    };
    const result = await new ClinicalNLUService(provider).interpret({
      question,
      rawAnswer: "Front",
      deterministic,
    });
    expect(provider.interpret).toHaveBeenCalledTimes(2);
    expect(result.answer).toBe(deterministic);
    expect(result.validationStatus).toBe("FALLBACK");
  });

  it("keeps deterministic pain scores and choices authoritative", async () => {
    const interpret = vi.fn<AIProvider["interpret"]>();
    const provider = { id: "test", interpret };
    const severityQuestion: InterviewQuestionDto = {
      ...question,
      id: "headache.severity",
      inputType: "SLIDER",
    };
    const severity: NormalizedAnswer = {
      ...deterministic,
      field: "severity",
      value: 7,
    };
    const result = await new ClinicalNLUService(provider).interpret({
      question: severityQuestion,
      rawAnswer: "seven",
      deterministic: severity,
    });
    expect(result.answer).toBe(severity);
    expect(result.provider).toBe("rules");
    expect(interpret).not.toHaveBeenCalled();
  });
});
