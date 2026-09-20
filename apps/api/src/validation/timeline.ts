import { z } from "zod";

const eventTypes = [
  "PATIENT_VISIT",
  "PATIENT_REPORTED_SYMPTOM",
  "CLINICAL_HISTORY_UPDATE",
  "MEDICATION_RECORDED",
  "MEDICATION_CHANGED",
  "ALLERGY_RECORDED",
  "LAB_RESULT",
  "OBSERVATION",
  "MEDICAL_DOCUMENT",
  "CONSULTATION_NOTE",
  "DISCHARGE_EVENT",
  "PROCEDURE",
  "DOCTOR_VERIFICATION",
  "RISK_SIGNAL",
] as const;

const sources = [
  "PATIENT_REPORTED",
  "VOICE_INTERVIEW",
  "DOCUMENT_EXTRACTED",
  "CLINICAL_RECORD",
  "DOCTOR_VERIFIED",
  "SYSTEM_GENERATED",
  "SAFETY_ENGINE",
] as const;

const statuses = [
  "DRAFT",
  "CAPTURED",
  "AI_STRUCTURED",
  "DOCUMENT_EXTRACTED",
  "PATIENT_CONFIRMED",
  "DOCTOR_VERIFIED",
  "REJECTED",
] as const;

const date = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value));

export const timelinePatientParamsSchema = z.object({
  patientId: z.string().min(8).max(128),
});

export const timelineEventParamsSchema = z.object({
  eventId: z.string().min(8).max(128),
});

export const timelineQuerySchema = z
  .object({
    from: date.optional(),
    to: date.optional(),
    eventType: z.enum(eventTypes).optional(),
    category: z.enum(["DOCUMENTS"]).optional(),
    sourceType: z.enum(sources).optional(),
    verificationStatus: z.enum(statuses).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().min(1).max(256).optional(),
    sort: z.enum(["asc", "desc"]).default("desc"),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "Timeline start date must be before the end date",
  });
