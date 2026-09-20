import { languageCodes } from "@helios/shared";
import { z } from "zod";

const supportedLanguageSchema = z.enum([
  languageCodes.English,
  languageCodes.Hindi,
]);

export const createSessionSchema = z
  .object({
    language: supportedLanguageSchema.default(languageCodes.English),
  })
  .strict();

export const updateProgressSchema = z
  .object({
    currentStep: z.enum([
      "WELCOME",
      "LANGUAGE",
      "CONSENT",
      "BASIC_INFO",
      "CHIEF_COMPLAINT",
      "INTERVIEW",
      "REVIEW",
      "SUBMITTED",
      "COMPLETE",
    ]),
    language: supportedLanguageSchema.optional(),
    draftData: z.record(z.string(), z.string()).optional(),
  })
  .strict();

export const createPatientSchema = z
  .object({
    sessionId: z.string().cuid(),
    fullName: z
      .string()
      .trim()
      .min(2, "Please enter a valid name.")
      .max(100, "Please use a shorter name.")
      .regex(/^[\p{L}][\p{L}\p{M} .'-]*$/u, "Please enter a valid name."),
    age: z.coerce
      .number()
      .int()
      .min(0, "Please enter your age.")
      .max(120, "Please enter a valid age."),
    sex: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]),
    preferredLanguage: supportedLanguageSchema,
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ]{8,15}$/, "Please enter a valid phone number.")
      .optional()
      .or(z.literal("")),
  })
  .strict();

export const createConsentSchema = z
  .object({
    sessionId: z.string().cuid(),
    consentType: z.literal("PRE_CONSULTATION"),
    accepted: z.literal(true, {
      error: "Please confirm that you understand before continuing.",
    }),
    version: z.literal("1.0"),
  })
  .strict();

export const createVisitSchema = z
  .object({
    patientId: z.string().cuid(),
    visitType: z
      .enum(["PRE_CONSULTATION", "FOLLOW_UP"])
      .default("PRE_CONSULTATION"),
    sessionId: z.string().cuid().optional(),
  })
  .strict();

export const saveComplaintSchema = z
  .object({
    chiefComplaint: z
      .string()
      .trim()
      .min(2, "Please describe what you are experiencing.")
      .max(4000),
    healthDetails: z
      .object({
        location: z.string().max(120).optional(),
        duration: z.string().max(120).optional(),
        vomiting: z.string().max(40).optional(),
      })
      .strict()
      .default({}),
  })
  .strict();

export const idParamSchema = z.object({ id: z.string().cuid() });
