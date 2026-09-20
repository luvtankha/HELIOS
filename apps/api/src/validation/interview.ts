import { languageCodes } from "@helios/shared";
import { z } from "zod";

export const interviewIdSchema = z.object({ id: z.string().cuid() });
export const createInterviewSchema = z.object({
  sessionId: z.string().cuid(),
  chiefComplaint: z.string().trim().min(2).max(4_000),
  language: z.enum([languageCodes.English, languageCodes.Hindi]),
});
export const interviewResponseSchema = z.object({
  questionId: z.string().trim().min(2).max(120),
  rawAnswer: z.string().trim().min(1).max(2_000),
  language: z.enum([languageCodes.English, languageCodes.Hindi]),
});
export const confirmInterviewResponseSchema = z.object({
  responseId: z.string().cuid(),
});
export const reviseInterviewSchema = z.object({
  field: z.string().trim().min(2).max(80),
});
