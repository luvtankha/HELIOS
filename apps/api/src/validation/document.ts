import { z } from "zod";

export const documentIdSchema = z.object({ id: z.string().min(8).max(128) });
export const documentPatientIdSchema = z.object({
  patientId: z.string().min(8).max(128),
});
export const documentFactParamsSchema = z.object({
  id: z.string().min(8).max(128),
  factId: z.string().min(8).max(128),
});
export const uploadDocumentSchema = z
  .object({
    sessionId: z.string().min(8).max(128),
    patientId: z.string().min(8).max(128),
    visitId: z.string().min(8).max(128).optional(),
  })
  .strict();
export const editDocumentFactSchema = z.object({ value: z.unknown() }).strict();
