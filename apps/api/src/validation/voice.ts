import { languageCodes } from "@helios/shared";
import { z } from "zod";

export const languageCodeSchema = z.enum([
  languageCodes.English,
  languageCodes.Hindi,
]);

export const transcribeFieldsSchema = z
  .object({
    sessionId: z.string().cuid(),
    language: languageCodeSchema,
    durationSeconds: z.coerce.number().min(0).max(120),
  })
  .strict();

export const voiceIdParamSchema = z.object({ id: z.string().cuid() });

export const editTranscriptSchema = z
  .object({
    transcript: z.string().trim().min(2).max(4_000),
  })
  .strict();

export const emptyVoiceActionSchema = z.object({}).strict();
