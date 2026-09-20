import type { Prisma, PrismaClient, VisitStatus } from "@prisma/client";
import { requireDatabase } from "./database.js";

const queueVisitInclude = {
  patient: {
    select: {
      id: true,
      patientCode: true,
      fullName: true,
      age: true,
      sex: true,
      phone: true,
      preferredLanguage: true,
    },
  },
  clinicalHistory: {
    select: { chiefComplaint: true, verificationStatus: true },
  },
  symptoms: { select: { name: true, verificationStatus: true } },
  medications: { select: { verificationStatus: true } },
  allergies: { select: { verificationStatus: true } },
  observations: { select: { verificationStatus: true } },
  documentFacts: { select: { verificationStatus: true, status: true } },
  ayushRecords: { select: { verificationStatus: true } },
  documents: {
    where: { deletedAt: null },
    select: { id: true, processingStatus: true, uploadedAt: true },
  },
  riskSignals: {
    where: {
      status: { in: ["OPEN", "ACKNOWLEDGED"] },
      category: { not: "FUTURE_DEMO_ONLY" },
    },
    select: {
      id: true,
      severity: true,
      title: true,
      createdAt: true,
      status: true,
    },
  },
} satisfies Prisma.VisitInclude;

export type DoctorQueueVisit = Prisma.VisitGetPayload<{
  include: typeof queueVisitInclude;
}>;

export class DoctorDashboardRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async doctor(id: string) {
    requireDatabase();
    return this.prisma.user.findFirst({
      where: { id, role: { in: ["DOCTOR", "ADMIN"] }, status: "ACTIVE" },
      select: {
        id: true,
        displayName: true,
        role: true,
        preferredLanguage: true,
      },
    });
  }

  async queueVisits(
    from: Date,
    useRecentActiveFallback: boolean,
    doctorId: string,
    isAdmin: boolean,
  ) {
    requireDatabase();
    const where: Prisma.VisitWhereInput = useRecentActiveFallback
      ? {
          status: {
            in: [
              "WAITING",
              "IN_PROGRESS",
              "READY_FOR_DOCTOR",
              "UNDER_REVIEW",
              "VERIFIED",
            ],
          },
        }
      : {
          startedAt: {
            gte: from,
            lt: new Date(new Date(from).setDate(from.getDate() + 1)),
          },
        };
    return this.prisma.visit.findMany({
      where: {
        ...where,
        ...(!isAdmin && {
          patient: { doctorAssignments: { some: { doctorId, active: true } } },
        }),
      },
      include: queueVisitInclude,
      orderBy: [{ startedAt: "asc" }, { id: "asc" }],
      take: 250,
    });
  }

  async assigned(doctorId: string, patientId: string, isAdmin: boolean) {
    requireDatabase();
    if (isAdmin) return true;
    return Boolean(
      await this.prisma.doctorPatientAssignment
        .findUnique({
          where: { doctorId_patientId: { doctorId, patientId } },
          select: { active: true },
        })
        .then((row) => row?.active),
    );
  }

  async patient(patientId: string) {
    requireDatabase();
    return this.prisma.patientProfile.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        patientCode: true,
        fullName: true,
        age: true,
        sex: true,
        phone: true,
        preferredLanguage: true,
      },
    });
  }

  async visit(patientId: string, visitId?: string) {
    requireDatabase();
    return this.prisma.visit.findFirst({
      where: { patientId, ...(visitId && { id: visitId }) },
      orderBy: { startedAt: "desc" },
      include: {
        clinicalHistory: true,
        symptoms: true,
        medications: { select: { verificationStatus: true } },
        allergies: { select: { verificationStatus: true } },
        observations: { select: { verificationStatus: true } },
        documentFacts: {
          select: { verificationStatus: true, status: true },
        },
        ayushRecords: { select: { verificationStatus: true } },
        riskSignals: { orderBy: { createdAt: "desc" } },
        interview: {
          select: {
            state: true,
            completeness: true,
            responses: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                rawAnswer: true,
                normalizedAnswer: true,
                status: true,
                verificationStatus: true,
              },
            },
          },
        },
      },
    });
  }

  async notes(patientId: string) {
    requireDatabase();
    return this.prisma.doctorNote.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      include: { author: { select: { id: true, displayName: true } } },
      take: 100,
    });
  }

  async createNote(
    patientId: string,
    visitId: string | undefined,
    authorId: string,
    content: string,
    requestId?: string,
  ) {
    requireDatabase();
    return this.prisma.$transaction(async (transaction) => {
      const note = await transaction.doctorNote.create({
        data: { patientId, ...(visitId && { visitId }), authorId, content },
        include: { author: { select: { id: true, displayName: true } } },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: authorId,
          action: "DOCTOR_NOTE_CREATED",
          entityType: "DoctorNote",
          entityId: note.id,
          ...(requestId && { requestId }),
          metadata: { patientId, visitId: visitId ?? null },
        },
      });
      return note;
    });
  }

  async updateNote(
    noteId: string,
    patientId: string,
    actorId: string,
    isAdmin: boolean,
    content: string,
    requestId?: string,
  ) {
    requireDatabase();
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.doctorNote.findFirst({
        where: { id: noteId, patientId },
      });
      if (!current || (!isAdmin && current.authorId !== actorId)) return null;
      const note = await transaction.doctorNote.update({
        where: { id: noteId },
        data: { content },
        include: { author: { select: { id: true, displayName: true } } },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: actorId,
          action: "DOCTOR_NOTE_UPDATED",
          entityType: "DoctorNote",
          entityId: note.id,
          ...(requestId && { requestId }),
          metadata: { patientId: note.patientId, visitId: note.visitId },
        },
      });
      return note;
    });
  }

  async transitionVisit(
    visitId: string,
    expectedStatus: VisitStatus,
    nextStatus: VisitStatus,
    actorId: string,
    requestId?: string,
  ) {
    requireDatabase();
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.visit.findUnique({
        where: { id: visitId },
        select: { id: true, patientId: true, status: true },
      });
      if (!current || current.status !== expectedStatus) return null;
      const updated = await transaction.visit.updateMany({
        where: { id: visitId, status: expectedStatus },
        data: {
          status: nextStatus,
          ...(nextStatus === "COMPLETED" && { completedAt: new Date() }),
        },
      });
      if (updated.count !== 1) return null;
      const visit = await transaction.visit.findUniqueOrThrow({
        where: { id: visitId },
        select: {
          id: true,
          patientId: true,
          status: true,
          startedAt: true,
          completedAt: true,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: actorId,
          action: "VISIT_STATUS_CHANGED",
          entityType: "Visit",
          entityId: visit.id,
          ...(requestId && { requestId }),
          metadata: {
            patientId: current.patientId,
            previousStatus: current.status,
            newStatus: nextStatus,
          },
        },
      });
      return { visit, previousStatus: current.status };
    });
  }

  async visitStatus(visitId: string) {
    requireDatabase();
    return this.prisma.visit.findUnique({
      where: { id: visitId },
      select: { id: true, patientId: true, status: true },
    });
  }

  async audit(
    actorUserId: string,
    action: string,
    entityType: string,
    entityId: string,
    requestId?: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    requireDatabase();
    return this.prisma.auditLog.create({
      data: {
        actorUserId,
        action,
        entityType,
        entityId,
        ...(requestId && { requestId }),
        ...(metadata && { metadata }),
      },
    });
  }
}
