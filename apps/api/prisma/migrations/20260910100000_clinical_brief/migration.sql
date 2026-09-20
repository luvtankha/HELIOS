CREATE TYPE "ClinicalBriefStatus" AS ENUM ('GENERATED', 'REVIEWED', 'STALE', 'ARCHIVED');
CREATE TYPE "BriefSectionType" AS ENUM ('PATIENT_SNAPSHOT', 'TODAYS_REASON', 'CURRENT_SYMPTOMS', 'WHAT_CHANGED', 'RELEVANT_HISTORY', 'MEDICATIONS', 'ALLERGIES', 'INVESTIGATIONS', 'SAFETY_ATTENTION', 'NEEDS_VERIFICATION', 'SUPPORTING_DOCUMENTS', 'SOURCE_EVIDENCE');

CREATE TABLE "ClinicalBrief" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "visitId" TEXT NOT NULL,
  "comparisonId" TEXT,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "generatorVersion" TEXT NOT NULL,
  "sourceRevision" TEXT NOT NULL,
  "cacheKey" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" "ClinicalBriefStatus" NOT NULL DEFAULT 'GENERATED',
  "sections" JSONB NOT NULL,
  "sourceReferences" JSONB NOT NULL,
  "createdBy" TEXT,
  "previousVersionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "reviewedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "ClinicalBrief_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BriefClaim" (
  "id" TEXT NOT NULL,
  "briefId" TEXT NOT NULL,
  "sectionType" "BriefSectionType" NOT NULL,
  "position" INTEGER NOT NULL,
  "claimKey" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "structuredValue" JSONB,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "evidenceReferences" JSONB NOT NULL,
  "verificationStatus" "TimelineEventStatus" NOT NULL,
  "confidence" DOUBLE PRECISION,
  "needsVerification" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BriefClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClinicalBrief_cacheKey_key" ON "ClinicalBrief"("cacheKey");
CREATE UNIQUE INDEX "ClinicalBrief_patientId_visitId_sourceRevision_generatorVersion_key" ON "ClinicalBrief"("patientId", "visitId", "sourceRevision", "generatorVersion");
CREATE INDEX "ClinicalBrief_patientId_visitId_createdAt_idx" ON "ClinicalBrief"("patientId", "visitId", "createdAt");
CREATE INDEX "ClinicalBrief_status_createdAt_idx" ON "ClinicalBrief"("status", "createdAt");
CREATE INDEX "ClinicalBrief_comparisonId_idx" ON "ClinicalBrief"("comparisonId");
CREATE INDEX "ClinicalBrief_previousVersionId_idx" ON "ClinicalBrief"("previousVersionId");
CREATE UNIQUE INDEX "BriefClaim_briefId_claimKey_key" ON "BriefClaim"("briefId", "claimKey");
CREATE INDEX "BriefClaim_briefId_sectionType_position_idx" ON "BriefClaim"("briefId", "sectionType", "position");
CREATE INDEX "BriefClaim_sourceType_sourceId_idx" ON "BriefClaim"("sourceType", "sourceId");
CREATE INDEX "BriefClaim_needsVerification_idx" ON "BriefClaim"("needsVerification");

ALTER TABLE "ClinicalBrief" ADD CONSTRAINT "ClinicalBrief_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClinicalBrief" ADD CONSTRAINT "ClinicalBrief_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClinicalBrief" ADD CONSTRAINT "ClinicalBrief_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "Comparison"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClinicalBrief" ADD CONSTRAINT "ClinicalBrief_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClinicalBrief" ADD CONSTRAINT "ClinicalBrief_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "ClinicalBrief"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BriefClaim" ADD CONSTRAINT "BriefClaim_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "ClinicalBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;
