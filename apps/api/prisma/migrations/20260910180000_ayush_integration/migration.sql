-- Phase 11: additive AYUSH information, provenance, and verification integration.
ALTER TYPE "ClinicalSource" ADD VALUE IF NOT EXISTS 'DOCTOR_ENTERED';
ALTER TYPE "ClinicalSource" ADD VALUE IF NOT EXISTS 'AYUSH_PRACTITIONER_DOCUMENTED';
ALTER TYPE "TimelineEventType" ADD VALUE IF NOT EXISTS 'AYUSH_TREATMENT';
ALTER TYPE "ComparisonEntityType" ADD VALUE IF NOT EXISTS 'AYUSH_RECORD';
ALTER TYPE "BriefSectionType" ADD VALUE IF NOT EXISTS 'AYUSH_USE';
ALTER TYPE "VerificationFactType" ADD VALUE IF NOT EXISTS 'AYUSH_RECORD';

CREATE TYPE "AyushSystem" AS ENUM (
  'AYURVEDA',
  'YOGA_NATUROPATHY',
  'UNANI',
  'SIDDHA',
  'HOMOEOPATHY',
  'OTHER_TRADITIONAL_SYSTEM',
  'UNKNOWN'
);

CREATE TYPE "AyushUseStatus" AS ENUM (
  'CURRENT',
  'HISTORICAL',
  'STOPPED',
  'UNKNOWN',
  'NOT_DOCUMENTED'
);

CREATE TYPE "AyushTemporalRelationship" AS ENUM (
  'REPORTED_AFTER',
  'DOCUMENTED_ALONGSIDE',
  'UNKNOWN'
);

CREATE TABLE "AyushRecord" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "visitId" TEXT,
  "interviewId" TEXT,
  "documentId" TEXT,
  "documentFactId" TEXT,
  "system" "AyushSystem" NOT NULL,
  "useStatus" "AyushUseStatus" NOT NULL DEFAULT 'UNKNOWN',
  "practitionerName" TEXT,
  "practitionerRegistrationId" TEXT,
  "facilityName" TEXT,
  "treatmentName" TEXT,
  "medicineName" TEXT,
  "originalName" TEXT NOT NULL,
  "normalizedName" TEXT,
  "ingredients" JSONB,
  "dosage" TEXT,
  "frequency" TEXT,
  "route" TEXT,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "indicationAsReported" TEXT,
  "patientReportedReason" TEXT,
  "reportedEffect" TEXT,
  "reportedEffectOnset" TIMESTAMP(3),
  "temporalRelationship" "AyushTemporalRelationship",
  "originalStatement" TEXT,
  "source" "ClinicalSource" NOT NULL,
  "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
  "verificationVersion" INTEGER NOT NULL DEFAULT 0,
  "evidenceReferences" JSONB NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AyushRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AyushRecord_interviewId_key" ON "AyushRecord"("interviewId");
CREATE UNIQUE INDEX "AyushRecord_documentFactId_key" ON "AyushRecord"("documentFactId");
CREATE INDEX "AyushRecord_patientId_useStatus_createdAt_idx" ON "AyushRecord"("patientId", "useStatus", "createdAt");
CREATE INDEX "AyushRecord_visitId_system_idx" ON "AyushRecord"("visitId", "system");
CREATE INDEX "AyushRecord_system_verificationStatus_idx" ON "AyushRecord"("system", "verificationStatus");
CREATE INDEX "AyushRecord_documentId_idx" ON "AyushRecord"("documentId");
CREATE INDEX "AyushRecord_source_createdAt_idx" ON "AyushRecord"("source", "createdAt");

ALTER TABLE "AyushRecord" ADD CONSTRAINT "AyushRecord_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AyushRecord" ADD CONSTRAINT "AyushRecord_visitId_fkey"
  FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AyushRecord" ADD CONSTRAINT "AyushRecord_interviewId_fkey"
  FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AyushRecord" ADD CONSTRAINT "AyushRecord_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "MedicalDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AyushRecord" ADD CONSTRAINT "AyushRecord_documentFactId_fkey"
  FOREIGN KEY ("documentFactId") REFERENCES "DocumentFact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
