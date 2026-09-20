import { z } from "zod";

const id = z.string().trim().min(1).max(256);
const factTypes = [
  "CLINICAL_HISTORY",
  "SYMPTOM",
  "MEDICATION",
  "ALLERGY",
  "OBSERVATION",
  "DOCUMENT_FACT",
  "INTERVIEW_RESPONSE",
  "AYUSH_RECORD",
] as const;
const statuses = [
  "UNREVIEWED",
  "PATIENT_REPORTED",
  "AI_STRUCTURED",
  "DOCUMENT_EXTRACTED",
  "NEEDS_REVIEW",
  "DOCTOR_VERIFIED",
  "DOCTOR_CORRECTED",
  "DOCTOR_REJECTED",
  "SUPERSEDED",
] as const;

export const verificationParamsSchema = z.object({ verificationId: id });
export const verificationDocumentParamsSchema = z.object({ documentId: id });
export const verificationPatientParamsSchema = z.object({ patientId: id });
export const verificationQueueSchema = z.object({
  status: z.enum(statuses).optional(),
  factType: z.enum(factTypes).optional(),
  conflictsOnly: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export const verificationActionSchema = z
  .object({
    expectedVersion: z.number().int().min(0),
    idempotencyKey: z.string().uuid(),
    reason: z.string().trim().min(3).max(500).optional(),
    comment: z.string().trim().min(1).max(2000).optional(),
    correctedValue: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export const verificationHistorySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export const bulkVerificationSchema = z
  .object({
    reviewIds: z.array(id).min(1).max(25),
    expectedVersions: z.record(z.string(), z.number().int().min(0)),
    idempotencyKey: z.string().uuid(),
  })
  .strict();
