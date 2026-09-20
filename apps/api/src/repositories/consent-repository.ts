import type { PrismaClient } from "@prisma/client";
import { requireDatabase } from "./database.js";

export class ConsentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async hasActivePreConsultationConsent(sessionId: string) {
    requireDatabase();
    return Boolean(
      await this.prisma.consentRecord.findFirst({
        where: {
          sessionId,
          consentType: "PRE_CONSULTATION",
          version: "1.0",
          accepted: true,
          withdrawnAt: null,
        },
        select: { id: true },
      }),
    );
  }

  async create(data: {
    sessionId: string;
    patientId?: string | undefined;
    consentType: string;
    accepted: boolean;
    version: string;
  }) {
    requireDatabase();
    return this.prisma.consentRecord.upsert({
      where: {
        sessionId_consentType_version: {
          sessionId: data.sessionId,
          consentType: data.consentType,
          version: data.version,
        },
      },
      create: {
        sessionId: data.sessionId,
        consentType: data.consentType,
        accepted: data.accepted,
        version: data.version,
        ...(data.patientId && { patientId: data.patientId }),
      },
      update: {
        accepted: data.accepted,
        acceptedAt: new Date(),
        withdrawnAt: null,
      },
    });
  }

  async attachPatient(sessionId: string, patientId: string) {
    requireDatabase();
    return this.prisma.consentRecord.updateMany({
      where: { sessionId },
      data: { patientId },
    });
  }
}
