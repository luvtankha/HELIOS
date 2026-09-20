import type { Prisma, PrismaClient } from "@prisma/client";
import { requireDatabase } from "./database.js";

export class ObservationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: Prisma.ObservationUncheckedCreateInput) {
    requireDatabase();
    return this.prisma.observation.create({ data });
  }

  async listForPatient(patientId: string) {
    requireDatabase();
    return this.prisma.observation.findMany({
      where: { patientId },
      orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
    });
  }

  async listForVisit(visitId: string) {
    requireDatabase();
    return this.prisma.observation.findMany({
      where: { visitId },
      orderBy: [{ effectiveAt: "asc" }, { createdAt: "asc" }],
    });
  }
}
