import type { Prisma, PrismaClient } from "@prisma/client";
import { requireDatabase } from "./database.js";

export const ayushInclude = {
  document: { select: { id: true, fileName: true, documentDate: true } },
  documentFact: {
    include: { evidence: { orderBy: { pageNumber: "asc" as const } } },
  },
  interview: {
    select: {
      responses: {
        where: { questionId: { startsWith: "common.ayush" } },
        orderBy: { createdAt: "asc" as const },
      },
    },
  },
} satisfies Prisma.AyushRecordInclude;

export type AyushRecordWithEvidence = Prisma.AyushRecordGetPayload<{
  include: typeof ayushInclude;
}>;

export class AyushRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async activeDoctor(id: string) {
    requireDatabase();
    return this.prisma.user.findFirst({
      where: { id, role: { in: ["DOCTOR", "ADMIN"] }, status: "ACTIVE" },
      select: { id: true, displayName: true, role: true },
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

  async sessionOwns(patientId: string, sessionId: string) {
    requireDatabase();
    return this.prisma.patientSession.findFirst({
      where: { id: sessionId, patientId },
      select: { id: true, visitId: true },
    });
  }

  async patientView(patientId: string) {
    requireDatabase();
    return this.prisma.patientProfile.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        fullName: true,
        patientCode: true,
        ayushRecords: {
          orderBy: [{ useStatus: "asc" }, { createdAt: "desc" }],
          include: ayushInclude,
        },
        medications: {
          where: {
            verificationStatus: {
              notIn: ["DOCTOR_REJECTED", "SUPERSEDED", "REJECTED"],
            },
          },
          orderBy: { createdAt: "desc" },
          take: 30,
        },
        visits: {
          select: {
            riskSignals: {
              where: {
                status: { in: ["OPEN", "ACKNOWLEDGED"] },
                source: { not: "FUTURE_DEMO_ONLY" },
              },
            },
          },
        },
      },
    });
  }

  async find(id: string) {
    requireDatabase();
    return this.prisma.ayushRecord.findUnique({
      where: { id },
      include: ayushInclude,
    });
  }

  async create(
    data: Prisma.AyushRecordUncheckedCreateInput,
    audit: { actorUserId?: string; action: string; requestId?: string },
  ) {
    requireDatabase();
    return this.prisma.$transaction(async (transaction) => {
      const record = await transaction.ayushRecord.create({
        data,
        include: ayushInclude,
      });
      await transaction.auditLog.create({
        data: {
          ...(audit.actorUserId && { actorUserId: audit.actorUserId }),
          action: audit.action,
          entityType: "AyushRecord",
          entityId: record.id,
          ...(audit.requestId && { requestId: audit.requestId }),
          metadata: {
            patientId: record.patientId,
            system: record.system,
            useStatus: record.useStatus,
            source: record.source,
            verificationStatus: record.verificationStatus,
          },
        },
      });
      await transaction.clinicalBrief.updateMany({
        where: {
          patientId: record.patientId,
          status: { in: ["GENERATED", "REVIEWED"] },
        },
        data: { status: "STALE" },
      });
      await transaction.comparison.updateMany({
        where: {
          patientId: record.patientId,
          status: { in: ["GENERATED", "REVIEWED"] },
        },
        data: { status: "STALE" },
      });
      return record;
    });
  }

  async upsertInterview(data: Prisma.AyushRecordUncheckedCreateInput) {
    requireDatabase();
    if (!data.interviewId) throw new Error("Interview identity is required");
    const update: Prisma.AyushRecordUncheckedUpdateInput = {
      system: data.system,
      originalName: data.originalName,
      evidenceReferences: data.evidenceReferences,
      verificationStatus: "NEEDS_REVIEW",
      ...(data.useStatus && { useStatus: data.useStatus }),
      ...(data.practitionerName !== undefined && {
        practitionerName: data.practitionerName,
      }),
      ...(data.treatmentName !== undefined && {
        treatmentName: data.treatmentName,
      }),
      ...(data.medicineName !== undefined && {
        medicineName: data.medicineName,
      }),
      ...(data.normalizedName !== undefined && {
        normalizedName: data.normalizedName,
      }),
      ...(data.startDate !== undefined && { startDate: data.startDate }),
      ...(data.reportedEffect !== undefined && {
        reportedEffect: data.reportedEffect,
      }),
      ...(data.temporalRelationship !== undefined && {
        temporalRelationship: data.temporalRelationship,
      }),
      ...(data.originalStatement !== undefined && {
        originalStatement: data.originalStatement,
      }),
    };
    return this.prisma.ayushRecord.upsert({
      where: { interviewId: data.interviewId },
      create: data,
      update,
      include: ayushInclude,
    });
  }

  async documentContext(documentId: string) {
    requireDatabase();
    return this.prisma.medicalDocument.findFirst({
      where: {
        id: documentId,
        deletedAt: null,
        identityStatus: { not: "IDENTITY_MISMATCH" },
      },
      include: {
        facts: {
          where: { factType: "ayush_treatment", status: { not: "REJECTED" } },
          include: { evidence: { orderBy: { pageNumber: "asc" } } },
        },
      },
    });
  }

  async upsertDocument(data: Prisma.AyushRecordUncheckedCreateInput) {
    requireDatabase();
    if (!data.documentFactId)
      throw new Error("Document fact identity is required");
    const documentFactId = data.documentFactId;
    const update: Prisma.AyushRecordUncheckedUpdateInput = {
      system: data.system,
      originalName: data.originalName,
      evidenceReferences: data.evidenceReferences,
      verificationStatus: "DOCUMENT_EXTRACTED",
      ...(data.useStatus && { useStatus: data.useStatus }),
      ...(data.treatmentName !== undefined && {
        treatmentName: data.treatmentName,
      }),
      ...(data.medicineName !== undefined && {
        medicineName: data.medicineName,
      }),
      ...(data.normalizedName !== undefined && {
        normalizedName: data.normalizedName,
      }),
      ...(data.dosage !== undefined && { dosage: data.dosage }),
      ...(data.frequency !== undefined && { frequency: data.frequency }),
      ...(data.route !== undefined && { route: data.route }),
      ...(data.practitionerName !== undefined && {
        practitionerName: data.practitionerName,
      }),
      ...(data.facilityName !== undefined && {
        facilityName: data.facilityName,
      }),
      ...(data.startDate !== undefined && { startDate: data.startDate }),
      ...(data.originalStatement !== undefined && {
        originalStatement: data.originalStatement,
      }),
    };
    return this.prisma.$transaction(async (transaction) => {
      const record = await transaction.ayushRecord.upsert({
        where: { documentFactId },
        create: data,
        update,
      });
      await transaction.auditLog.create({
        data: {
          action: "AYUSH_PROJECTED_FROM_DOCUMENT",
          entityType: "AyushRecord",
          entityId: record.id,
          metadata: {
            patientId: record.patientId,
            documentId: record.documentId,
            documentFactId: record.documentFactId,
            verificationStatus: record.verificationStatus,
          },
        },
      });
      await staleDependents(transaction, record.patientId);
      return record;
    });
  }

  async supersedeMissingDocumentRecords(documentId: string, factIds: string[]) {
    requireDatabase();
    return this.prisma.$transaction(async (transaction) => {
      const where: Prisma.AyushRecordWhereInput = {
        documentId,
        ...(factIds.length && { documentFactId: { notIn: factIds } }),
        verificationStatus: { not: "SUPERSEDED" },
      };
      const records = await transaction.ayushRecord.findMany({
        where,
        select: { id: true, patientId: true, documentFactId: true },
      });
      const result = await transaction.ayushRecord.updateMany({
        where,
        data: {
          verificationStatus: "SUPERSEDED",
          verificationVersion: { increment: 1 },
        },
      });
      if (records.length) {
        await transaction.auditLog.createMany({
          data: records.map((record) => ({
            action: "AYUSH_DOCUMENT_SOURCE_SUPERSEDED",
            entityType: "AyushRecord",
            entityId: record.id,
            metadata: {
              patientId: record.patientId,
              documentId,
              documentFactId: record.documentFactId,
            },
          })),
        });
        for (const patientId of new Set(
          records.map((record) => record.patientId),
        ))
          await staleDependents(transaction, patientId);
      }
      return result;
    });
  }

  async patientIdForDocument(documentId: string) {
    requireDatabase();
    const record = await this.prisma.ayushRecord.findFirst({
      where: { documentId },
      select: { patientId: true },
    });
    return record?.patientId ?? null;
  }
}

async function staleDependents(
  transaction: Prisma.TransactionClient,
  patientId: string,
) {
  await transaction.clinicalBrief.updateMany({
    where: { patientId, status: { in: ["GENERATED", "REVIEWED"] } },
    data: { status: "STALE" },
  });
  await transaction.comparison.updateMany({
    where: { patientId, status: { in: ["GENERATED", "REVIEWED"] } },
    data: { status: "STALE" },
  });
}
