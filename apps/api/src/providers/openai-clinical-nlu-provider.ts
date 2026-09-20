import type { AIProvider } from "../interview/clinical-nlu.js";
import { clinicalExtractionInstructions } from "../interview/clinical-nlu.js";
import { AppError } from "../utils/app-error.js";

interface ResponsesPayload {
  output_text?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export class OpenAIClinicalNLUProvider implements AIProvider {
  readonly id = "openai";

  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly timeoutMs: number,
  ) {}

  async interpret(input: Parameters<AIProvider["interpret"]>[0]) {
    if (!this.apiKey)
      throw new AppError(
        "Clinical interpretation is unavailable",
        503,
        "AI_NOT_CONFIGURED",
      );
    const schema = {
      type: "object",
      additionalProperties: false,
      required: ["field", "value", "state", "confidence", "ambiguous"],
      properties: {
        field: { type: "string" },
        value: {
          type: ["string", "number", "boolean", "array", "object", "null"],
        },
        state: { type: "string", enum: ["YES", "NO", "UNKNOWN"] },
        confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
        ambiguous: { type: "boolean" },
      },
    };
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        store: false,
        instructions: clinicalExtractionInstructions,
        input: JSON.stringify({
          question: {
            id: input.question.id,
            text: input.question.text,
            inputType: input.question.inputType,
          },
          patientAnswer: input.answer,
          ...(input.relevantFact !== undefined && {
            existingRelevantFact: input.relevantFact,
          }),
          ...(input.retry && {
            correction:
              "The previous output failed schema validation. Return only valid schema-matching JSON.",
          }),
        }),
        text: {
          format: {
            type: "json_schema",
            name: "clinical_extraction",
            strict: true,
            schema,
          },
        },
        max_output_tokens: 300,
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok)
      throw new AppError(
        "Clinical interpretation is unavailable",
        502,
        "AI_PROVIDER_FAILED",
      );
    const payload = (await response.json()) as ResponsesPayload;
    if (!payload.output_text) throw new Error("Missing structured output");
    return {
      output: JSON.parse(payload.output_text) as unknown,
      ...(payload.usage?.input_tokens !== undefined && {
        inputTokens: payload.usage.input_tokens,
      }),
      ...(payload.usage?.output_tokens !== undefined && {
        outputTokens: payload.usage.output_tokens,
      }),
    };
  }
}
