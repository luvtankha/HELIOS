import type { Prisma, PrismaClient, VisitType } from "@prisma/client";
import { requireDatabase } from "./database.js";

export class VisitRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(patientId: string, visitType: VisitType = "PRE_CONSULTATION") {
    requireDatabase();
    return this.prisma.visit.create({
      data: { patientId, visitType, status: "IN_PROGRESS" },
    });
  }

  async findById(id: string) {
    requireDatabase();
    return this.prisma.visit.findUnique({
      where: { id },
      include: {
        clinicalHistory: true,
        symptoms: true,
        documents: true,
        timelineEvents: { orderBy: { eventDate: "desc" } },
      },
    });
  }

  async saveComplaint(
    id: string,
    complaint: string,
    healthDetails: {
      location?: string | undefined;
      duration?: string | undefined;
      vomiting?: string | undefined;
    },
  ): Promise<Prisma.VisitGetPayload<{ include: { clinicalHistory: true } }>> {
    requireDatabase();
    const historyData = {
      chiefComplaint: complaint,
      ...(healthDetails.duration && {
        duration: { value: healthDetails.duration },
      }),
      ...(healthDetails.location && {
        location: { value: healthDetails.location },
      }),
      ...(healthDetails.vomiting && {
        associatedSymptoms: { vomiting: healthDetails.vomiting },
      }),
    } satisfies Prisma.ClinicalHistoryCreateWithoutVisitInput;
    return this.prisma.visit.update({
      where: { id },
      data: {
        clinicalHistory: {
          upsert: {
            create: historyData,
            update: historyData,
          },
        },
      },
      include: { clinicalHistory: true },
    });
  }
}
