import {
  Prisma,
  type PatientFlowStep,
  type PatientSessionStatus,
  type PrismaClient,
} from "@prisma/client";
import { requireDatabase } from "./database.js";

export class SessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(language: string) {
    requireDatabase();
    return this.prisma.patientSession.create({
      data: { language, currentStep: "LANGUAGE" },
    });
  }

  async findById(id: string) {
    requireDatabase();
    return this.prisma.patientSession.findUnique({
      where: { id },
      include: {
        patient: true,
        visit: { include: { clinicalHistory: true } },
      },
    });
  }

  /** Minimal context for the transcription hot path; avoids loading history. */
  async findVoiceContext(id: string) {
    requireDatabase();
    return this.prisma.patientSession.findUnique({
      where: { id },
      select: { id: true, language: true, visitId: true },
    });
  }

  async updateProgress(
    id: string,
    data: {
      currentStep: PatientFlowStep;
      status?: PatientSessionStatus | undefined;
      language?: string | undefined;
      draftData?: Prisma.InputJsonValue | undefined;
    },
  ) {
    requireDatabase();
    const update: Prisma.PatientSessionUncheckedUpdateInput = {
      currentStep: data.currentStep,
      lastActiveAt: new Date(),
      ...(data.status && { status: data.status }),
      ...(data.language && { language: data.language }),
      ...(data.draftData && { draftData: data.draftData }),
    };
    return this.prisma.$transaction(async (transaction) => {
      const session = await transaction.patientSession.update({
        where: { id },
        data: update,
      });
      if (data.language && session.patientId)
        await transaction.patientProfile.update({
          where: { id: session.patientId },
          data: { preferredLanguage: data.language },
        });
      return session;
    });
  }

  async attachPatientAndVisit(id: string, patientId: string, visitId: string) {
    requireDatabase();
    return this.prisma.patientSession.update({
      where: { id },
      data: {
        patientId,
        visitId,
        status: "IN_PROGRESS",
        currentStep: "CHIEF_COMPLAINT",
        lastActiveAt: new Date(),
      },
    });
  }
}
