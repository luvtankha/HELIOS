ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'UNREVIEWED';
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'PATIENT_REPORTED';
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'AI_STRUCTURED';
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'DOCUMENT_EXTRACTED';
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'NEEDS_REVIEW';
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'DOCTOR_VERIFIED';
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'DOCTOR_CORRECTED';
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'DOCTOR_REJECTED';
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'SUPERSEDED';

CREATE TYPE "VerificationAction" AS ENUM (
  'VERIFY', 'CORRECT', 'REJECT', 'MARK_UNCERTAIN',
  'CONFIRM_CURRENT', 'KEEP_PREVIOUS', 'SUPERSEDE'
);
CREATE TYPE "VerificationFactType" AS ENUM (
  'CLINICAL_HISTORY', 'SYMPTOM', 'MEDICATION', 'ALLERGY',
  'OBSERVATION', 'DOCUMENT_FACT', 'INTERVIEW_RESPONSE'
);

ALTER TABLE "ClinicalHistory"
  ADD COLUMN "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PATIENT_REPORTED',
  ADD COLUMN "verificationVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Symptom"
  ADD COLUMN "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PATIENT_REPORTED',
  ADD COLUMN "verificationVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Medication"
  ADD COLUMN "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PATIENT_REPORTED',
  ADD COLUMN "verificationVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Allergy"
  ADD COLUMN "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PATIENT_REPORTED',
  ADD COLUMN "verificationVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Observation"
  ADD COLUMN "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNREVIEWED',
  ADD COLUMN "verificationVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DocumentFact"
  ADD COLUMN "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'DOCUMENT_EXTRACTED',
  ADD COLUMN "verificationVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "InterviewResponse"
  ADD COLUMN "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PATIENT_REPORTED',
  ADD COLUMN "verificationVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Medication" SET "verificationStatus" = CASE
  WHEN "verifiedAt" IS NOT NULL THEN 'DOCTOR_VERIFIED'::"VerificationStatus"
  WHEN "source" = 'DOCUMENT_EXTRACTED' THEN 'DOCUMENT_EXTRACTED'::"VerificationStatus"
  WHEN "source" = 'AI_STRUCTURED' THEN 'AI_STRUCTURED'::"VerificationStatus"
  ELSE 'PATIENT_REPORTED'::"VerificationStatus" END;
UPDATE "Allergy" SET "verificationStatus" = CASE
  WHEN "verifiedAt" IS NOT NULL THEN 'DOCTOR_VERIFIED'::"VerificationStatus"
  WHEN "source" = 'DOCUMENT_EXTRACTED' THEN 'DOCUMENT_EXTRACTED'::"VerificationStatus"
  WHEN "source" = 'AI_STRUCTURED' THEN 'AI_STRUCTURED'::"VerificationStatus"
  ELSE 'PATIENT_REPORTED'::"VerificationStatus" END;
UPDATE "Observation" SET "verificationStatus" = CASE
  WHEN "source" = 'DOCTOR_VERIFIED' THEN 'DOCTOR_VERIFIED'::"VerificationStatus"
  WHEN "source" = 'DOCUMENT_EXTRACTED' THEN 'DOCUMENT_EXTRACTED'::"VerificationStatus"
  WHEN "source" = 'AI_STRUCTURED' THEN 'AI_STRUCTURED'::"VerificationStatus"
  WHEN "source" = 'PATIENT_REPORTED' THEN 'PATIENT_REPORTED'::"VerificationStatus"
  ELSE 'UNREVIEWED'::"VerificationStatus" END;
UPDATE "DocumentFact" SET "verificationStatus" = CASE
  WHEN "status" = 'VERIFIED' THEN 'DOCTOR_VERIFIED'::"VerificationStatus"
  WHEN "status" = 'REJECTED' THEN 'DOCTOR_REJECTED'::"VerificationStatus"
  WHEN "status" = 'NEEDS_REVIEW' THEN 'NEEDS_REVIEW'::"VerificationStatus"
  ELSE 'DOCUMENT_EXTRACTED'::"VerificationStatus" END;

DROP INDEX IF EXISTS "DoctorVerification_visitId_status_idx";
DROP INDEX IF EXISTS "DoctorVerification_entityType_entityId_idx";
ALTER TABLE "DoctorVerification" DROP CONSTRAINT IF EXISTS "DoctorVerification_visitId_fkey";
ALTER TABLE "DoctorVerification" RENAME COLUMN "entityType" TO "factTypeText";
ALTER TABLE "DoctorVerification" RENAME COLUMN "entityId" TO "factId";
ALTER TABLE "DoctorVerification" RENAME COLUMN "notes" TO "comment";
ALTER TABLE "DoctorVerification"
  ADD COLUMN "patientId" TEXT,
  ADD COLUMN "factType" "VerificationFactType",
  ADD COLUMN "action" "VerificationAction" NOT NULL DEFAULT 'VERIFY',
  ADD COLUMN "previousStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "newStatus" "VerificationStatus",
  ADD COLUMN "sourceType" "ClinicalSource" NOT NULL DEFAULT 'DOCTOR_VERIFIED',
  ADD COLUMN "evidenceReferences" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "reason" TEXT,
  ADD COLUMN "factVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "createdAt" TIMESTAMP(3);
UPDATE "DoctorVerification" d SET
  "patientId" = v."patientId",
  "factType" = CASE UPPER(d."factTypeText")
    WHEN 'CLINICAL_HISTORY' THEN 'CLINICAL_HISTORY'::"VerificationFactType"
    WHEN 'SYMPTOM' THEN 'SYMPTOM'::"VerificationFactType"
    WHEN 'MEDICATION' THEN 'MEDICATION'::"VerificationFactType"
    WHEN 'ALLERGY' THEN 'ALLERGY'::"VerificationFactType"
    WHEN 'OBSERVATION' THEN 'OBSERVATION'::"VerificationFactType"
    WHEN 'DOCUMENT_FACT' THEN 'DOCUMENT_FACT'::"VerificationFactType"
    WHEN 'INTERVIEW_RESPONSE' THEN 'INTERVIEW_RESPONSE'::"VerificationFactType"
    ELSE 'CLINICAL_HISTORY'::"VerificationFactType" END,
  "newStatus" = d."status",
  "idempotencyKey" = d."id",
  "createdAt" = d."verifiedAt"
FROM "Visit" v WHERE v."id" = d."visitId";
ALTER TABLE "DoctorVerification"
  ALTER COLUMN "patientId" SET NOT NULL,
  ALTER COLUMN "factType" SET NOT NULL,
  ALTER COLUMN "newStatus" SET NOT NULL,
  ALTER COLUMN "idempotencyKey" SET NOT NULL,
  ALTER COLUMN "createdAt" SET NOT NULL,
  ALTER COLUMN "visitId" DROP NOT NULL;
ALTER TABLE "DoctorVerification" DROP COLUMN "factTypeText";
ALTER TABLE "DoctorVerification" ALTER COLUMN "action" DROP DEFAULT;
ALTER TABLE "DoctorVerification" ALTER COLUMN "sourceType" DROP DEFAULT;
CREATE UNIQUE INDEX "DoctorVerification_idempotencyKey_key" ON "DoctorVerification"("idempotencyKey");
CREATE INDEX "DoctorVerification_patientId_newStatus_verifiedAt_idx" ON "DoctorVerification"("patientId", "newStatus", "verifiedAt");
CREATE INDEX "DoctorVerification_visitId_newStatus_idx" ON "DoctorVerification"("visitId", "newStatus");
CREATE INDEX "DoctorVerification_factType_factId_verifiedAt_idx" ON "DoctorVerification"("factType", "factId", "verifiedAt");
ALTER TABLE "DoctorVerification" ADD CONSTRAINT "DoctorVerification_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DoctorVerification" ADD CONSTRAINT "DoctorVerification_visitId_fkey"
  FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
