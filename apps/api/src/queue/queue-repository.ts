import { Prisma, type PrismaClient } from "@prisma/client";
import { requireDatabase } from "../repositories/database.js";
import { env } from "../config/env.js";
const tokenInclude = {
  patient: {
    select: {
      id: true,
      patientCode: true,
      fullName: true,
      age: true,
      sex: true,
    },
  },
  visit: { include: { clinicalHistory: { select: { chiefComplaint: true } } } },
} satisfies Prisma.QueueEntryInclude;
export type QueueRow = Prisma.QueueEntryGetPayload<{
  include: typeof tokenInclude;
}>;
export class QueueRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async checkIn(
    sessionId: string,
    queueKey: string,
    queueDate: Date,
    prefix: string,
  ) {
    requireDatabase();
    return this.prisma.$transaction(
      async (tx) => {
        const session = await tx.patientSession.findUnique({
          where: { id: sessionId },
          include: {
            visit: { include: { clinicalHistory: true } },
          },
        });
        if (
          !session?.patientId ||
          !session.visitId ||
          !session.visit?.clinicalHistory?.chiefComplaint
        )
          return { kind: "INCOMPLETE" as const };
        const existing = await tx.queueEntry.findUnique({
          where: { visitId: session.visitId },
          include: tokenInclude,
        });
        if (existing) return { kind: "EXISTING" as const, row: existing };
        const counter = await tx.queueCounter.upsert({
          where: { queueKey_queueDate: { queueKey, queueDate } },
          create: { queueKey, queueDate, nextValue: 2 },
          update: { nextValue: { increment: 1 } },
        });
        const sequence = counter.nextValue - 1;
        const tokenNumber = `${prefix}-${String(sequence).padStart(3, "0")}`;
        const priority = (await tx.riskSignal.count({
          where: {
            visitId: session.visitId,
            severity: "HIGH",
            status: { in: ["OPEN", "ACKNOWLEDGED"] },
            category: { not: "FUTURE_DEMO_ONLY" },
          },
        }))
          ? "PRIORITY_REVIEW"
          : "NORMAL";
        const row = await tx.queueEntry.create({
          data: {
            queueKey,
            queueDate,
            sequence,
            tokenNumber,
            patientId: session.patientId,
            visitId: session.visitId,
            priority,
            ...(session.visit?.preferredDoctorId && {
              doctorId: session.visit.preferredDoctorId,
            }),
          },
          include: tokenInclude,
        });
        const preferredDoctorId = session.visit?.preferredDoctorId;
        if (preferredDoctorId) {
          await tx.doctorPatientAssignment.upsert({
            where: {
              doctorId_patientId: {
                doctorId: preferredDoctorId,
                patientId: session.patientId,
              },
            },
            create: {
              doctorId: preferredDoctorId,
              patientId: session.patientId,
            },
            update: { active: true },
          });
        } else if (env.DEMO_MODE) {
          const demoDoctor = await tx.user.findFirst({
            where: { role: "DOCTOR", status: "ACTIVE" },
            orderBy: { createdAt: "asc" },
            select: { id: true },
          });
          if (demoDoctor)
            await tx.doctorPatientAssignment.upsert({
              where: {
                doctorId_patientId: {
                  doctorId: demoDoctor.id,
                  patientId: session.patientId,
                },
              },
              create: { doctorId: demoDoctor.id, patientId: session.patientId },
              update: { active: true },
            });
        }
        const now = new Date();
        await tx.visit.update({
          where: { id: session.visitId },
          data: { status: "READY_FOR_DOCTOR", tokenNumber },
        });
        await tx.patientSession.update({
          where: { id: sessionId },
          data: {
            status: "COMPLETED",
            currentStep: "COMPLETE",
            completedAt: now,
            lastActiveAt: now,
            draftData: Prisma.DbNull,
          },
        });
        await tx.timelineEvent.updateMany({
          where: {
            patientId: session.patientId,
            visitId: session.visitId,
            eventType: "PATIENT_VISIT",
          },
          data: {
            description: "Ready for doctor",
            verificationStatus: "CAPTURED",
            recordedAt: now,
          },
        });
        await this.event(tx, row.id, "TOKEN_CREATED", sessionId, "PATIENT", {
          queueKey,
          tokenNumber,
        });
        await this.event(
          tx,
          row.id,
          "PATIENT_CHECKED_IN",
          sessionId,
          "PATIENT",
        );
        return { kind: "CREATED" as const, row };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  async bySession(sessionId: string) {
    requireDatabase();
    return this.prisma.queueEntry.findFirst({
      where: { visit: { session: { id: sessionId } } },
      include: tokenInclude,
    });
  }
  async byVisit(visitId: string) {
    requireDatabase();
    return this.prisma.queueEntry.findUnique({
      where: { visitId },
      include: tokenInclude,
    });
  }
  async queue(queueKey: string, queueDate: Date, doctorId?: string) {
    requireDatabase();
    return this.prisma.queueEntry.findMany({
      where: {
        queueKey,
        queueDate,
        ...(doctorId && {
          patient: { doctorAssignments: { some: { doctorId, active: true } } },
        }),
      },
      include: tokenInclude,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 250,
    });
  }
  async counter(queueKey: string, queueDate: Date) {
    requireDatabase();
    return this.prisma.queueCounter.findUnique({
      where: { queueKey_queueDate: { queueKey, queueDate } },
    });
  }
  private async event(
    tx: Prisma.TransactionClient,
    tokenId: string,
    action: string,
    actorId: string,
    actorRole: string,
    metadata?: Prisma.InputJsonValue,
    requestId?: string,
  ) {
    await tx.queueEvent.create({
      data: {
        tokenId,
        action,
        actorId,
        actorRole,
        ...(metadata && { metadata }),
      },
    });
    await tx.auditLog.create({
      data: {
        ...(actorRole === "DOCTOR" && { actorUserId: actorId }),
        action,
        entityType: "QueueEntry",
        entityId: tokenId,
        ...(requestId && { requestId }),
        ...(metadata && { metadata }),
      },
    });
  }
}
