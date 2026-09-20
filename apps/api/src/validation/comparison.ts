import { z } from "zod";

export const doctorSessionSchema = z
  .object({
    username: z.string().trim().min(1).max(100),
    accessCode: z.string().min(8).max(200),
  })
  .strict();
export const comparisonParamsSchema = z.object({
  id: z.string().min(1).max(128),
});
export const changeParamsSchema = z.object({
  id: z.string().min(1).max(128),
  changeId: z.string().min(1).max(128),
});
export const comparisonPatientParamsSchema = z.object({
  patientId: z.string().min(1).max(128),
});
export const createComparisonSchema = z
  .object({
    previousVisitId: z.string().min(1),
    currentVisitId: z.string().min(1),
  })
  .strict();
export const comparisonListSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export const comparisonChangesSchema = z.object({
  changeType: z
    .enum([
      "NEW",
      "REMOVED",
      "CHANGED",
      "UNCHANGED",
      "CONFLICTED",
      "UNKNOWN",
      "NOT_COMPARABLE",
      "NEWLY_CAPTURED",
    ])
    .optional(),
  entityType: z
    .enum([
      "SYMPTOM",
      "MEDICATION",
      "ALLERGY",
      "OBSERVATION",
      "CLINICAL_HISTORY_FIELD",
      "DOCUMENT",
      "RISK_SIGNAL",
    ])
    .optional(),
  needsReview: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});
