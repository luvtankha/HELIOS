import { z } from "zod";

export const activeLanguageSchema = z.enum(["en", "hi"]);
export const languageParamsSchema = z.object({
  code: z.string().min(2).max(8),
});
export const detectLanguageSchema = z.object({
  text: z.string().min(1).max(4_000),
  selectedLanguage: activeLanguageSchema.optional(),
});
export const normalizeLanguageSchema = z.object({
  text: z.string().min(1).max(4_000),
  language: activeLanguageSchema,
});
export const translateSchema = z.object({
  text: z.string().min(1).max(4_000),
  sourceLanguage: activeLanguageSchema,
  targetLanguage: activeLanguageSchema,
  contextType: z.enum([
    "UI",
    "PATIENT_QUESTION",
    "PATIENT_CONFIRMATION",
    "SAFETY_MESSAGE",
    "DOCTOR_DISPLAY",
  ]),
});
export const doctorLanguageSchema = z.object({
  language: activeLanguageSchema,
});
