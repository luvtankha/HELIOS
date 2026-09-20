import { z } from "zod";

export const requestIdSchema = z.string().regex(/^req_[a-zA-Z0-9]+$/);
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
