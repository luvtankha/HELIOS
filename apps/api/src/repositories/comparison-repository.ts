import type { Prisma, PrismaClient } from "@prisma/client";
import { requireDatabase } from "./database.js";

export const comparisonInclude = {
  patient: { select: { fullName: true } },
  previousVisit: { select: { startedAt: true } },
  currentVisit: { select: { startedAt: true } },
  previousSnapshot: { select: { sourceRevision: true } },
  currentSnapshot: { select: { sourceRevision: true } },
  changes: {
    orderBy: [
      { needsReview: "desc" as const },
      { changeType: "asc" as const },
      { entityKey: "asc" as const },
    ],
  },
} satisfies Prisma.ComparisonInclude;

export class ComparisonRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async doctor(id: string) {
    requireDatabase();
    return this.prisma.user.findFirst({
      where: { id, role: { in: ["DOCTOR", "ADMIN"] }, status: "ACTIVE" },
    });
  }
  async doctorByUsername(username: string) {
    requireDatabase();
    return this.prisma.user.findFirst({
      where: { username, role: { in: ["DOCTOR", "ADMIN"] }, status: "ACTIVE" },
    });
  }
  async visits(patientId: string, visitIds?: string[]) {
    requireDatabase();
    return this.prisma.visit.findMany({
      where: { patientId, ...(visitIds && { id: { in: visitIds } }) },
      select: {
        id: true,
        patientId: true,
        startedAt: true,
        status: true,
        tokenNumber: true,
      },
      orderBy: { startedAt: "desc" },
    });
  }
  async patients(doctorId: string, isAdmin: boolean) {
    requireDatabase();
    return this.prisma.patientProfile.findMany({
      where: {
        visits: { some: {} },
        ...(!isAdmin && {
          doctorAssignments: { some: { doctorId, active: true } },
        }),
      },
      select: {
        id: true,
        patientCode: true,
        fullName: true,
        visits: {
          select: {
            id: true,
            startedAt: true,
            status: true,
            tokenNumber: true,
          },
          orderBy: { startedAt: "desc" },
        },
      },
      orderBy: { fullName: "asc" },
      take: 100,
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
  async events(patientId: string, visitId: string) {
    requireDatabase();
    return this.prisma.timelineEvent.findMany({
      where: { patientId, visitId, verificationStatus: { not: "REJECTED" } },
      orderBy: [{ normalizedKey: "asc" }, { id: "asc" }],
    });
  }
  async snapshot(
    sourceRevision: string,
    data: Prisma.PatientSnapshotUncheckedCreateInput,
  ) {
    requireDatabase();
    return this.prisma.patientSnapshot.upsert({
      where: {
        patientId_visitId_sourceRevision: {
          patientId: data.patientId,
          visitId: data.visitId,
          sourceRevision,
        },
      },
      update: {},
      create: data,
    });
  }
  async cached(cacheKey: string) {
    requireDatabase();
    return this.prisma.comparison.findUnique({
      where: { cacheKey },
      include: comparisonInclude,
    });
  }
  async create(
    data: Prisma.ComparisonUncheckedCreateInput,
    changes: Prisma.ChangeRecordUncheckedCreateWithoutComparisonInput[],
  ) {
    requireDatabase();
    return this.prisma.comparison.create({
      data: { ...data, changes: { create: changes } },
      include: comparisonInclude,
    });
  }
  async detail(id: string) {
    requireDatabase();
    return this.prisma.comparison.findUnique({
      where: { id },
      include: comparisonInclude,
    });
  }
  async list(patientId: string, limit: number) {
    requireDatabase();
    return this.prisma.comparison.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: comparisonInclude,
    });
  }
  async markStale(id: string) {
    requireDatabase();
    return this.prisma.comparison.update({
      where: { id },
      data: { status: "STALE" },
      include: comparisonInclude,
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
        entityType: "Comparison",
        entityId,
        ...(requestId && { requestId }),
        ...(metadata && { metadata }),
      },
    });
  }
}
