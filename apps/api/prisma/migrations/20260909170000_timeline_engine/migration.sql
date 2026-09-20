-- Phase 7 turns TimelineEvent into a rebuildable, provenance-aware index.
CREATE TYPE "TimelineEventType" AS ENUM ('PATIENT_VISIT', 'PATIENT_REPORTED_SYMPTOM', 'CLINICAL_HISTORY_UPDATE', 'MEDICATION_RECORDED', 'MEDICATION_CHANGED', 'ALLERGY_RECORDED', 'LAB_RESULT', 'OBSERVATION', 'MEDICAL_DOCUMENT', 'CONSULTATION_NOTE', 'DISCHARGE_EVENT', 'PROCEDURE', 'DOCTOR_VERIFICATION', 'RISK_SIGNAL');
CREATE TYPE "TimelineDatePrecision" AS ENUM ('EXACT_DATE', 'MONTH_ONLY', 'YEAR_ONLY', 'DATE_RANGE', 'UNKNOWN');
CREATE TYPE "TimelineEventStatus" AS ENUM ('DRAFT', 'CAPTURED', 'AI_STRUCTURED', 'DOCUMENT_EXTRACTED', 'PATIENT_CONFIRMED', 'DOCTOR_VERIFIED', 'REJECTED');
CREATE TYPE "TimelineTemporalState" AS ENUM ('CURRENT', 'HISTORICAL', 'UNKNOWN', 'DISCONTINUED', 'NOT_APPLICABLE');
CREATE TYPE "TimelineMedicationAction" AS ENUM ('STARTED', 'REPORTED', 'CHANGED', 'CONFIRMED', 'DISCONTINUED');

ALTER TYPE "TimelineSource" RENAME TO "TimelineSource_old";
CREATE TYPE "TimelineSource" AS ENUM ('PATIENT_REPORTED', 'VOICE_INTERVIEW', 'DOCUMENT_EXTRACTED', 'CLINICAL_RECORD', 'DOCTOR_VERIFIED', 'SYSTEM_GENERATED', 'SAFETY_ENGINE');
ALTER TABLE "TimelineEvent" ALTER COLUMN "source" TYPE "TimelineSource" USING (
  CASE "source"::text
    WHEN 'DOCUMENT' THEN 'DOCUMENT_EXTRACTED'
    WHEN 'AI_EXTRACTED' THEN 'DOCUMENT_EXTRACTED'
    WHEN 'SYSTEM' THEN 'SYSTEM_GENERATED'
    ELSE "source"::text
  END
)::"TimelineSource";
DROP TYPE "TimelineSource_old";

DROP INDEX IF EXISTS "TimelineEvent_documentId_key";
ALTER TABLE "TimelineEvent" ALTER COLUMN "eventDate" DROP NOT NULL;
ALTER TABLE "TimelineEvent" ALTER COLUMN "eventType" TYPE "TimelineEventType" USING (
  CASE
    WHEN "eventType" IN ('DOCUMENT', 'LAB_REPORT') THEN 'MEDICAL_DOCUMENT'
    WHEN "eventType" IN ('PRE_CONSULTATION_STARTED', 'READY_FOR_DOCTOR', 'SYNTHETIC_VISIT', 'TEST') THEN 'PATIENT_VISIT'
    ELSE 'CLINICAL_HISTORY_UPDATE'
  END
)::"TimelineEventType";
ALTER TABLE "TimelineEvent"
  ADD COLUMN "documentFactId" TEXT,
  ADD COLUMN "eventEndDate" TIMESTAMP(3),
  ADD COLUMN "datePrecision" "TimelineDatePrecision" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "temporalState" "TimelineTemporalState" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "medicationAction" "TimelineMedicationAction",
  ADD COLUMN "sourceType" TEXT,
  ADD COLUMN "sourceId" TEXT,
  ADD COLUMN "sourceText" TEXT,
  ADD COLUMN "temporalText" TEXT,
  ADD COLUMN "pageNumber" INTEGER,
  ADD COLUMN "verificationStatus" "TimelineEventStatus" NOT NULL DEFAULT 'CAPTURED',
  ADD COLUMN "confidence" DOUBLE PRECISION,
  ADD COLUMN "originalValue" JSONB,
  ADD COLUMN "normalizedValue" JSONB,
  ADD COLUMN "groupKey" TEXT,
  ADD COLUMN "normalizedKey" TEXT,
  ADD COLUMN "fingerprint" TEXT,
  ADD COLUMN "conflictKey" TEXT,
  ADD COLUMN "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "TimelineEvent" SET
  "datePrecision" = CASE WHEN "eventDate" IS NULL THEN 'UNKNOWN'::"TimelineDatePrecision" ELSE 'EXACT_DATE'::"TimelineDatePrecision" END,
  "sourceType" = CASE WHEN "documentId" IS NOT NULL THEN 'MEDICAL_DOCUMENT' ELSE COALESCE("eventType"::text, 'TIMELINE_EVENT') END,
  "sourceId" = COALESCE("documentId", "visitId", "id"),
  "normalizedKey" = lower(regexp_replace("title", '[^a-zA-Z0-9]+', '-', 'g')),
  "fingerprint" = md5("patientId" || ':' || "id"),
  "recordedAt" = "createdAt";

ALTER TABLE "TimelineEvent"
  ALTER COLUMN "sourceType" SET NOT NULL,
  ALTER COLUMN "sourceId" SET NOT NULL,
  ALTER COLUMN "normalizedKey" SET NOT NULL,
  ALTER COLUMN "fingerprint" SET NOT NULL;

CREATE TABLE "TimelineEventVersion" (
  "id" TEXT NOT NULL,
  "timelineEventId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "changeReason" TEXT NOT NULL,
  CONSTRAINT "TimelineEventVersion_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "TimelineEventVersion" ADD CONSTRAINT "TimelineEventVersion_timelineEventId_fkey" FOREIGN KEY ("timelineEventId") REFERENCES "TimelineEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_documentFactId_fkey" FOREIGN KEY ("documentFactId") REFERENCES "DocumentFact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "TimelineEvent_fingerprint_key" ON "TimelineEvent"("fingerprint");
CREATE INDEX "TimelineEvent_patientId_eventDate_recordedAt_idx" ON "TimelineEvent"("patientId", "eventDate", "recordedAt");
CREATE INDEX "TimelineEvent_patientId_eventType_eventDate_idx" ON "TimelineEvent"("patientId", "eventType", "eventDate");
CREATE INDEX "TimelineEvent_patientId_source_eventDate_idx" ON "TimelineEvent"("patientId", "source", "eventDate");
CREATE INDEX "TimelineEvent_patientId_verificationStatus_eventDate_idx" ON "TimelineEvent"("patientId", "verificationStatus", "eventDate");
CREATE INDEX "TimelineEvent_visitId_eventDate_idx" ON "TimelineEvent"("visitId", "eventDate");
CREATE INDEX "TimelineEvent_documentId_eventDate_idx" ON "TimelineEvent"("documentId", "eventDate");
CREATE INDEX "TimelineEvent_documentFactId_idx" ON "TimelineEvent"("documentFactId");
CREATE INDEX "TimelineEvent_groupKey_eventDate_idx" ON "TimelineEvent"("groupKey", "eventDate");
CREATE INDEX "TimelineEvent_conflictKey_idx" ON "TimelineEvent"("conflictKey");
CREATE UNIQUE INDEX "TimelineEventVersion_timelineEventId_version_key" ON "TimelineEventVersion"("timelineEventId", "version");
CREATE INDEX "TimelineEventVersion_timelineEventId_changedAt_idx" ON "TimelineEventVersion"("timelineEventId", "changedAt");
