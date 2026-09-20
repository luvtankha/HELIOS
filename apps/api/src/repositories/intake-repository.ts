import { createHash } from "node:crypto";
import type { PatientSex, PrismaClient } from "@prisma/client";
import { AppError } from "../utils/app-error.js";
import { requireDatabase } from "./database.js";

export class IntakeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createPatientVisit(input: {
    sessionId: string;
    patientCode: string;
    fullName: string;
    age: number;
    sex: PatientSex;
    preferredLanguage: string;
    phone?: string | undefined;
  }) {
    requireDatabase();
    return this.prisma.$transaction(async (transaction) => {
      const consent = await transaction.consentRecord.findFirst({
        where: {
          sessionId: input.sessionId,
          consentType: "PRE_CONSULTATION",
          version: "1.0",
          accepted: true,
          withdrawnAt: null,
        },
        select: { id: true },
      });
      if (!consent)
        throw new AppError(
          "Consent is required before saving patient details",
          403,
          "CONSENT_REQUIRED",
        );
      const claimed = await transaction.patientSession.updateMany({
        where: { id: input.sessionId, patientId: null, visitId: null },
        data: { lastActiveAt: new Date() },
      });
      if (claimed.count !== 1)
        throw new AppError(
          "Patient details have already been saved",
          409,
          "PATIENT_EXISTS",
        );
      const patient = await transaction.patientProfile.create({
        data: {
          patientCode: input.patientCode,
          fullName: input.fullName,
          age: input.age,
          sex: input.sex,
          preferredLanguage: input.preferredLanguage,
          ...(input.phone && { phone: input.phone }),
        },
      });
      const visit = await transaction.visit.create({
        data: {
          patientId: patient.id,
          visitType: "PRE_CONSULTATION",
          status: "IN_PROGRESS",
        },
      });
      await transaction.patientSession.update({
        where: { id: input.sessionId },
        data: {
          patientId: patient.id,
          visitId: visit.id,
          status: "IN_PROGRESS",
          currentStep: "CHIEF_COMPLAINT",
          lastActiveAt: new Date(),
        },
      });
      await transaction.consentRecord.updateMany({
        where: { sessionId: input.sessionId },
        data: { patientId: patient.id },
      });
      await transaction.timelineEvent.create({
        data: {
          patientId: patient.id,
          visitId: visit.id,
          eventType: "PATIENT_VISIT",
          title: "Pre-consultation started",
          source: "CLINICAL_RECORD",
          sourceType: "VISIT",
          sourceId: visit.id,
          normalizedKey: "visit",
          fingerprint: createHash("sha256")
            .update(
              `${patient.id}:PATIENT_VISIT:CLINICAL_RECORD:${visit.id}:visit`,
            )
            .digest("hex"),
          datePrecision: "EXACT_DATE",
          temporalState: "CURRENT",
          verificationStatus: "CAPTURED",
          eventDate: new Date(),
          recordedAt: new Date(),
          groupKey: `visit:${visit.id}`,
        },
      });
      return { patient, visit };
    });
  }
}
