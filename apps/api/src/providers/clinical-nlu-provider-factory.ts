import { env } from "../config/env.js";
import type { AIProvider } from "../interview/clinical-nlu.js";
import { OpenAIClinicalNLUProvider } from "./openai-clinical-nlu-provider.js";

export function createClinicalNLUProvider(): AIProvider | undefined {
  return env.CLINICAL_NLU_PROVIDER === "openai"
    ? new OpenAIClinicalNLUProvider(
        env.AI_API_KEY,
        env.AI_MODEL,
        env.AI_TIMEOUT_MS,
      )
    : undefined;
}
