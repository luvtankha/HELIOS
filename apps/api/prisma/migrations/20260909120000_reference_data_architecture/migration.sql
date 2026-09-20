ALTER TYPE "ClinicalSource" ADD VALUE IF NOT EXISTS 'DOCUMENT_EXTRACTED';
ALTER TYPE "ClinicalSource" ADD VALUE IF NOT EXISTS 'SYSTEM_GENERATED';

ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_CORRECT';
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'MISSED';

CREATE TYPE "KnowledgeState" AS ENUM (
  'YES',
  'NO',
  'UNKNOWN',
  'NOT_ASKED',
  'NOT_APPLICABLE',
  'CONFLICT'
);

ALTER TABLE "Interview"
ADD COLUMN "questionGraphVersion" TEXT NOT NULL DEFAULT 'phase4-v1';

CREATE TABLE "Observation" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "visitId" TEXT,
  "conceptKey" TEXT NOT NULL,
  "display" TEXT NOT NULL,
  "codeSystem" TEXT,
  "code" TEXT,
  "category" TEXT,
  "value" JSONB,
  "unit" TEXT,
  "referenceRange" JSONB,
  "state" "KnowledgeState" NOT NULL DEFAULT 'YES',
  "status" TEXT NOT NULL DEFAULT 'FINAL',
  "effectiveAt" TIMESTAMP(3),
  "source" "ClinicalSource" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Observation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Observation_patientId_effectiveAt_idx"
ON "Observation"("patientId", "effectiveAt");
CREATE INDEX "Observation_visitId_category_idx"
ON "Observation"("visitId", "category");
CREATE INDEX "Observation_conceptKey_effectiveAt_idx"
ON "Observation"("conceptKey", "effectiveAt");
CREATE INDEX "Observation_source_createdAt_idx"
ON "Observation"("source", "createdAt");

ALTER TABLE "Observation"
ADD CONSTRAINT "Observation_patientId_fkey"
FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Observation"
ADD CONSTRAINT "Observation_visitId_fkey"
FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
