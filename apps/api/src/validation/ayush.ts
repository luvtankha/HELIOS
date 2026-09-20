import { z } from "zod";

const id = z.string().trim().min(1).max(256);
const optionalText = z.string().trim().min(1).max(500).optional();
const date = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date")
  .optional();

export const ayushPatientParamsSchema = z.object({ patientId: id });
export const ayushRecordParamsSchema = z.object({ recordId: id });
export const ayushInputSchema = z
  .object({
    visitId: id.optional(),
    system: z.enum([
      "AYURVEDA",
      "YOGA_NATUROPATHY",
      "UNANI",
      "SIDDHA",
      "HOMOEOPATHY",
      "OTHER_TRADITIONAL_SYSTEM",
      "UNKNOWN",
    ]),
    useStatus: z.enum([
      "CURRENT",
      "HISTORICAL",
      "STOPPED",
      "UNKNOWN",
      "NOT_DOCUMENTED",
    ]),
    practitionerName: optionalText,
    practitionerRegistrationId: optionalText,
    facilityName: optionalText,
    treatmentName: optionalText,
    medicineName: optionalText,
    originalName: optionalText,
    ingredients: z.array(z.string().trim().min(1).max(200)).max(100).optional(),
    dosage: optionalText,
    frequency: optionalText,
    route: optionalText,
    startDate: date,
    endDate: date,
    indicationAsReported: optionalText,
    patientReportedReason: optionalText,
    reportedEffect: optionalText,
    reportedEffectOnset: date,
    originalStatement: z.string().trim().min(1).max(4_000).optional(),
    notes: z.string().trim().min(1).max(2_000).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.originalName && !value.medicineName && !value.treatmentName)
      context.addIssue({
        code: "custom",
        path: ["originalName"],
        message: "Use NOT_SPECIFIED when the treatment name is unknown",
      });
    if (
      value.endDate &&
      value.startDate &&
      new Date(value.endDate) < new Date(value.startDate)
    )
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date cannot be before start date",
      });
  });

export const doctorAyushInputSchema = ayushInputSchema.and(
  z.object({
    source: z
      .enum(["DOCTOR_ENTERED", "AYUSH_PRACTITIONER_DOCUMENTED"])
      .optional(),
  }),
);
