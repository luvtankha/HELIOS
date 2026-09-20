import type { Prisma, PrismaClient } from "@prisma/client";
import { requireDatabase } from "./database.js";

export class ClinicalHistoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsert(
    visitId: string,
    data: Omit<Prisma.ClinicalHistoryUncheckedCreateInput, "id" | "visitId">,
  ) {
    requireDatabase();
    return this.prisma.clinicalHistory.upsert({
      where: { visitId },
      create: { ...data, visitId },
      update: data,
    });
  }
}
