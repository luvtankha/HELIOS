import { z } from "zod";

export const briefPatientParamsSchema = z.object({
  patientId: z.string().min(1).max(128),
});
export const briefParamsSchema = z.object({
  briefId: z.string().min(1).max(128),
});
export const briefClaimParamsSchema = z.object({
  briefId: z.string().min(1).max(128),
  claimId: z.string().min(1).max(128),
});
export const createBriefSchema = z.object({
  visitId: z.string().min(1).max(128),
});
export const quickBriefSchema = z.object({
  visitId: z.string().min(1).max(128).optional(),
});
export const briefListSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
