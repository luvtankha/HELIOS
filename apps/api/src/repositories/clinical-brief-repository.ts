import type { Prisma, PrismaClient } from "@prisma/client";
import { requireDatabase } from "./database.js";

export const briefInclude = {
  patient: {
    select: {
      fullName: true,
      patientCode: true,
      age: true,
      sex: true,
      preferredLanguage: true,
    },
  },
  visit: { select: { startedAt: true } },
  claims: {
    orderBy: [{ sectionType: "asc" as const }, { position: "asc" as const }],
  },
} satisfies Prisma.ClinicalBriefInclude;

export type BriefRecord = Prisma.ClinicalBriefGetPayload<{
  include: typeof briefInclude;
}>;

export class ClinicalBriefRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async doctor(id: string) {
    requireDatabase();
    return this.prisma.user.findFirst({
      where: { id, role: { in: ["DOCTOR", "ADMIN"] }, status: "ACTIVE" },
    });
  }

  async assigned(doctorId: string, patientId: string, isAdmin: boolean) {
    requireDatabase();
    if (isAdmin) return true;
    return Boolean(
      (
        await this.prisma.doctorPatientAssignment.findUnique({
          where: { doctorId_patientId: { doctorId, patientId } },
          select: { active: true },
        })
      )?.active,
    );
  }

  async source(patientId: string, visitId: string, recentFrom: Date) {
    requireDatabase();
    const patient = await this.prisma.patientProfile.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        fullName: true,
        patientCode: true,
        age: true,
        sex: true,
        preferredLanguage: true,
        allergies: {
          where: {
            verificationStatus: {
              notIn: ["DOCTOR_REJECTED", "SUPERSEDED", "REJECTED"],
            },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        medications: {
          where: {
            verificationStatus: {
              notIn: ["DOCTOR_REJECTED", "SUPERSEDED", "REJECTED"],
            },
            OR: [{ visitId }, { createdAt: { gte: recentFrom } }],
          },
          orderBy: { createdAt: "desc" },
          take: 30,
        },
        observations: {
          where: {
            verificationStatus: {
              notIn: ["DOCTOR_REJECTED", "SUPERSEDED", "REJECTED"],
            },
            OR: [{ visitId }, { effectiveAt: { gte: recentFrom } }],
          },
          orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
          take: 30,
        },
        ayushRecords: {
          where: {
            verificationStatus: {
              notIn: ["DOCTOR_REJECTED", "SUPERSEDED", "REJECTED"],
            },
          },
          orderBy: [{ useStatus: "asc" }, { createdAt: "desc" }],
          take: 20,
        },
        documents: {
          where: {
            deletedAt: null,
            identityStatus: { not: "IDENTITY_MISMATCH" },
            OR: [{ visitId }, { documentDate: { gte: recentFrom } }],
          },
          orderBy: [{ documentDate: "desc" }, { uploadedAt: "desc" }],
          take: 20,
          include: {
            facts: {
              where: {
                status: { not: "REJECTED" },
                verificationStatus: {
                  notIn: ["DOCTOR_REJECTED", "SUPERSEDED", "REJECTED"],
                },
              },
              include: {
                evidence: { orderBy: { pageNumber: "asc" }, take: 2 },
              },
            },
          },
        },
      },
    });
    if (!patient) return null;
    const visit = await this.prisma.visit.findFirst({
      where: { id: visitId, patientId },
      include: {
        clinicalHistory: true,
        symptoms: {
          where: {
            verificationStatus: {
              notIn: ["DOCTOR_REJECTED", "SUPERSEDED", "REJECTED"],
            },
          },
        },
        riskSignals: true,
      },
    });
    if (!visit) return null;
    const history = await this.prisma.timelineEvent.findMany({
      where: {
        patientId,
        visitId: { not: visitId },
        eventDate: { gte: recentFrom },
        verificationStatus: { not: "REJECTED" },
        eventType: {
          in: ["CLINICAL_HISTORY_UPDATE", "PROCEDURE", "DOCTOR_VERIFICATION"],
        },
      },
      orderBy: [{ eventDate: "desc" }, { recordedAt: "desc" }],
      take: 12,
      select: {
        id: true,
        title: true,
        description: true,
        eventDate: true,
        source: true,
        verificationStatus: true,
      },
    });
    const comparison = await this.prisma.comparison.findFirst({
      where: {
        patientId,
        currentVisitId: visitId,
        status: { in: ["GENERATED", "REVIEWED"] },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        changes: {
          orderBy: [{ needsReview: "desc" }, { createdAt: "asc" }],
          take: 30,
        },
      },
    });
    return { patient, visit, history, comparison };
  }

  async cached(cacheKey: string) {
    requireDatabase();
    return this.prisma.clinicalBrief.findUnique({
      where: { cacheKey },
      include: briefInclude,
    });
  }
  async latest(patientId: string, visitId: string) {
    requireDatabase();
    return this.prisma.clinicalBrief.findFirst({
      where: { patientId, visitId, status: { not: "ARCHIVED" } },
      orderBy: { version: "desc" },
      include: briefInclude,
    });
  }
  async latestVisit(patientId: string) {
    requireDatabase();
    return this.prisma.visit.findFirst({
      where: { patientId },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    });
  }
  async detail(id: string) {
    requireDatabase();
    return this.prisma.clinicalBrief.findUnique({
      where: { id },
      include: briefInclude,
    });
  }
  async list(patientId: string, limit: number) {
    requireDatabase();
    return this.prisma.clinicalBrief.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: briefInclude,
    });
  }
  async create(
    data: Prisma.ClinicalBriefUncheckedCreateInput,
    claims: Prisma.BriefClaimUncheckedCreateWithoutBriefInput[],
  ) {
    requireDatabase();
    return this.prisma.clinicalBrief.create({
      data: { ...data, claims: { create: claims } },
      include: briefInclude,
    });
  }
  async markStale(id: string) {
    requireDatabase();
    return this.prisma.clinicalBrief.update({
      where: { id },
      data: { status: "STALE" },
      include: briefInclude,
    });
  }
  async status(id: string, status: "REVIEWED" | "ARCHIVED") {
    requireDatabase();
    return this.prisma.clinicalBrief.update({
      where: { id },
      data: {
        status,
        ...(status === "REVIEWED"
          ? { reviewedAt: new Date() }
          : { archivedAt: new Date() }),
      },
      include: briefInclude,
    });
  }
  async claim(briefId: string, claimId: string) {
    requireDatabase();
    return this.prisma.briefClaim.findFirst({
      where: { id: claimId, briefId },
      include: {
        brief: {
          select: { patientId: true, visitId: true, comparisonId: true },
        },
      },
    });
  }
  async audit(
    actorUserId: string,
    action: string,
    entityId: string,
    requestId?: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    requireDatabase();
    return this.prisma.auditLog.create({
      data: {
        actorUserId,
        action,
        entityType: "ClinicalBrief",
        entityId,
        ...(requestId && { requestId }),
        ...(metadata && { metadata }),
      },
    });
  }
}
