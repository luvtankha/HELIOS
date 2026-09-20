import { z } from "zod";

export const boundingBoxSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().finite().nonnegative(),
    height: z.number().finite().nonnegative(),
  })
  .strict();

export const extractedDocumentFactSchema = z
  .object({
    factType: z.string().min(1).max(80),
    originalValue: z.unknown(),
    normalizedValue: z.unknown().optional(),
    confidence: z.number().min(0).max(1),
    pageNumber: z.number().int().positive(),
    sourceText: z.string().min(1).max(4_000),
    originalLanguage: z.enum(["en", "hi"]).optional(),
    boundingBox: boundingBoxSchema.optional(),
  })
  .strict();

export const documentUnderstandingSchema = z
  .object({
    facts: z.array(extractedDocumentFactSchema).max(500),
    documentDate: z.iso.date().optional(),
    patientName: z.string().min(1).max(200).optional(),
    summary: z.string().min(1).max(1_000),
  })
  .strict();
