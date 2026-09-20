import { Prisma, type PrismaClient, type QueueStatus } from "@prisma/client";
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
            create: { doctorId: preferredDoctorId, patientId: session.patientId },
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
  async byId(id: string) {
    requireDatabase();
    return this.prisma.queueEntry.findUnique({
      where: { id },
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
  async doctor(id: string) {
    requireDatabase();
    return this.prisma.user.findFirst({
      where: { id, status: "ACTIVE", role: { in: ["DOCTOR", "ADMIN"] } },
      select: { id: true, role: true, displayName: true },
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

  async callNext(
    queueKey: string,
    queueDate: Date,
    doctorId: string,
    allowedPatientIds: string[],
    requestId?: string,
  ) {
    requireDatabase();
    return this.prisma.$transaction(
      async (tx) => {
        const control = await tx.queueCounter.findUnique({
          where: { queueKey_queueDate: { queueKey, queueDate } },
        });
        if (control?.paused) return { kind: "PAUSED" as const };
        const active = await tx.queueEntry.findFirst({
          where: {
            queueKey,
            queueDate,
            status: "CALLED",
            patientId: { in: allowedPatientIds },
          },
          include: tokenInclude,
          orderBy: { calledAt: "asc" },
        });
        if (active) return { kind: "ACTIVE" as const, row: active };
        const waiting = await tx.queueEntry.findMany({
          where: {
            queueKey,
            queueDate,
            status: "WAITING",
            patientId: { in: allowedPatientIds },
          },
          include: tokenInclude,
          orderBy: [{ priority: "desc" }, { createdAt: "asc" }, { id: "asc" }],
          take: 1,
        });
        const next = waiting[0];
        if (!next) return { kind: "EMPTY" as const };
        const changed = await tx.queueEntry.updateMany({
          where: { id: next.id, status: "WAITING" },
          data: { status: "CALLED", calledAt: new Date(), doctorId },
        });
        if (changed.count !== 1) return { kind: "RACE" as const };
        await this.event(
          tx,
          next.id,
          "TOKEN_CALLED",
          doctorId,
          "DOCTOR",
          { queueKey },
          requestId,
        );
        return {
          kind: "CALLED" as const,
          row: await tx.queueEntry.findUniqueOrThrow({
            where: { id: next.id },
            include: tokenInclude,
          }),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async transition(
    id: string,
    expected: QueueStatus,
    next: QueueStatus,
    action: string,
    actorId: string,
    actorRole: string,
    requestId?: string,
  ) {
    requireDatabase();
    return this.prisma.$transaction(
      async (tx) => {
        const current = await tx.queueEntry.findUnique({
          where: { id },
          include: tokenInclude,
        });
        if (!current || current.status !== expected) return null;
        const now = new Date();
        const changed = await tx.queueEntry.updateMany({
          where: { id, status: expected },
          data: {
            status: next,
            ...(next === "CALLED" && { calledAt: now, doctorId: actorId }),
            ...(next === "IN_CONSULTATION" && {
              consultationStartedAt: now,
              doctorId: actorId,
            }),
            ...(["COMPLETED", "CANCELLED", "NO_SHOW", "SKIPPED"].includes(
              next,
            ) && { completedAt: now }),
          },
        });
        if (changed.count !== 1) return null;
        if (next === "IN_CONSULTATION")
          await tx.visit.update({
            where: { id: current.visitId },
            data: { status: "IN_PROGRESS" },
          });
        if (next === "COMPLETED")
          await tx.visit.update({
            where: { id: current.visitId },
            data: { status: "COMPLETED", completedAt: now },
          });
        await this.event(
          tx,
          id,
          action,
          actorId,
          actorRole,
          { previousStatus: expected, newStatus: next },
          requestId,
        );
        return tx.queueEntry.findUniqueOrThrow({
          where: { id },
          include: tokenInclude,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async recall(id: string, actorId: string, requestId?: string) {
    requireDatabase();
    return this.prisma.$transaction(
      async (tx) => {
        const row = await tx.queueEntry.findUnique({
          where: { id },
          include: tokenInclude,
        });
        if (!row || row.status !== "CALLED") return null;
        await tx.queueEntry.update({
          where: { id },
          data: { calledAt: new Date() },
        });
        await this.event(
          tx,
          id,
          "TOKEN_RECALLED",
          actorId,
          "DOCTOR",
          undefined,
          requestId,
        );
        return tx.queueEntry.findUniqueOrThrow({
          where: { id },
          include: tokenInclude,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async pause(
    queueKey: string,
    queueDate: Date,
    paused: boolean,
    actorId: string,
    requestId?: string,
  ) {
    requireDatabase();
    return this.prisma.$transaction(
      async (tx) => {
        const counter = await tx.queueCounter.upsert({
          where: { queueKey_queueDate: { queueKey, queueDate } },
          create: { queueKey, queueDate, paused },
          update: { paused },
        });
        await tx.auditLog.create({
          data: {
            actorUserId: actorId,
            action: paused ? "QUEUE_PAUSED" : "QUEUE_RESUMED",
            entityType: "QueueCounter",
            entityId: counter.id,
            ...(requestId && { requestId }),
            metadata: { queueKey },
          },
        });
        return counter;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
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
