import { z } from "zod";

const booleanString = (defaultValue = false) =>
  z
    .enum(["true", "false"])
    .default(defaultValue ? "true" : "false")
    .transform((value) => value === "true");

const localSessionSecret = "helios-local-session-secret";

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().positive().max(65_535).default(5000),
    DATABASE_URL: z.string().trim().default(""),
    WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    STORAGE_PROVIDER: z.enum(["local"]).default("local"),
    STORAGE_PATH: z.string().default("./uploads"),
    ENABLE_VOICE: booleanString(),
    ENABLE_SPECIALIZATION_ROUTING: booleanString(),
    ENABLE_OCR: booleanString(),
    ENABLE_AI_INTERVIEW: booleanString(),
    ENABLE_RISK_ENGINE: booleanString(),
    ENABLE_AYUSH: booleanString(),
    ENABLE_DEMO_MODE: booleanString(true),
    DEMO_MODE: booleanString(true),
    SESSION_TOKEN_SECRET: z.string().min(16).default(localSessionSecret),
    PATIENT_SESSION_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(300)
      .max(86_400)
      .default(28_800),
    DOCTOR_SESSION_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(300)
      .max(43_200)
      .default(3_600),
    DOCTOR_DEMO_ACCESS_CODE: z.string().min(8).default("helios-demo-doctor"),
    BRIEF_RECENT_MONTHS: z.coerce.number().int().min(1).max(120).default(12),
    BRIEF_MAX_SYMPTOMS: z.coerce.number().int().min(1).max(20).default(6),
    BRIEF_MAX_CHANGES: z.coerce.number().int().min(1).max(20).default(6),
    BRIEF_MAX_DOCUMENTS: z.coerce.number().int().min(1).max(20).default(5),
    SPEECH_PROVIDER: z.enum(["mock", "openai", "local"]).default("mock"),
    SPEECH_LOCAL_PYTHON: z.string().trim().optional(),
    SPEECH_LOCAL_MODEL_PATH: z.string().trim().optional(),
    SPEECH_LOCAL_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(180_000)
      .default(120_000),
    SPEECH_API_KEY: z.string().trim().default(""),
    SPEECH_MODEL: z.string().trim().default("gpt-4o-mini-transcribe"),
    SPEECH_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(120_000)
      .default(30_000),
    VOICE_MAX_DURATION_SECONDS: z.coerce
      .number()
      .int()
      .min(10)
      .max(120)
      .default(75),
    VOICE_MAX_FILE_BYTES: z.coerce
      .number()
      .int()
      .min(64_000)
      .max(25_000_000)
      .default(8_000_000),
    DOCUMENT_MAX_FILE_BYTES: z.coerce
      .number()
      .int()
      .min(100_000)
      .max(50_000_000)
      .default(15_000_000),
    DOCUMENT_PROCESSING_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(5_000)
      .max(300_000)
      .default(90_000),
    DOCUMENT_OCR_PROVIDER: z.enum(["mock", "local"]).default("mock"),
    DOCUMENT_PROCESSING_VERSION: z.string().trim().default("phase6-v1"),
    CLINICAL_NLU_PROVIDER: z.enum(["rules", "openai"]).default("rules"),
    AI_API_KEY: z.string().trim().default(""),
    AI_MODEL: z.string().trim().default("gpt-4.1-mini"),
    AI_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(60_000)
      .default(12_000),
  })
  .superRefine((value, context) => {
    if (
      value.NODE_ENV === "production" &&
      value.SESSION_TOKEN_SECRET === localSessionSecret
    ) {
      context.addIssue({
        code: "custom",
        path: ["SESSION_TOKEN_SECRET"],
        message: "must be replaced in production",
      });
    }
    if (value.NODE_ENV === "production" && value.ENABLE_DEMO_MODE) {
      context.addIssue({
        code: "custom",
        path: ["ENABLE_DEMO_MODE"],
        message: "must be false in production",
      });
    }
    if (value.NODE_ENV === "production" && value.DEMO_MODE) {
      context.addIssue({
        code: "custom",
        path: ["DEMO_MODE"],
        message: "must be false in production",
      });
    }
    if (
      value.NODE_ENV === "production" &&
      value.DOCTOR_DEMO_ACCESS_CODE === "helios-demo-doctor"
    ) {
      context.addIssue({
        code: "custom",
        path: ["DOCTOR_DEMO_ACCESS_CODE"],
        message: "must be replaced in production",
      });
    }
    if (
      value.NODE_ENV === "production" &&
      /(^|[\\/])public([\\/]|$)/i.test(value.STORAGE_PATH)
    ) {
      context.addIssue({
        code: "custom",
        path: ["STORAGE_PATH"],
        message: "must not be inside a public directory",
      });
    }
  });

export type Environment = z.infer<typeof envSchema>;

export function parseEnvironment(input: NodeJS.ProcessEnv): Environment {
  const result = envSchema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return result.data;
}

export const env = parseEnvironment(process.env);
