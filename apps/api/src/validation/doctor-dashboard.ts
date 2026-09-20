import { z } from "zod";

const id = z.string().trim().min(1).max(128);

export const doctorDashboardQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z
    .enum([
      "WAITING",
      "IN_PROGRESS",
      "NEEDS_REVIEW",
      "HIGH_PRIORITY_REVIEW",
      "VERIFIED",
      "COMPLETED",
    ])
    .optional(),
  sort: z.enum(["time", "priority", "name"]).default("time"),
  direction: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const doctorPatientParamsSchema = z.object({ patientId: id });
export const doctorWorkspaceQuerySchema = z.object({ visitId: id.optional() });
export const doctorNoteParamsSchema = z.object({ patientId: id, noteId: id });
export const doctorVisitParamsSchema = z.object({ visitId: id });

export const doctorNoteCreateSchema = z
  .object({
    visitId: id.optional(),
    content: z.string().trim().min(1).max(4_000),
  })
  .strict();

export const doctorNoteUpdateSchema = z
  .object({
    content: z.string().trim().min(1).max(4_000),
  })
  .strict();

export const doctorVisitTransitionSchema = z
  .object({
    status: z.enum(["IN_PROGRESS", "UNDER_REVIEW", "VERIFIED", "COMPLETED"]),
  })
  .strict();
