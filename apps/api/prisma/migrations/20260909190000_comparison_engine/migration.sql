CREATE TYPE "ComparisonStatus" AS ENUM ('GENERATED', 'REVIEWED', 'ARCHIVED', 'STALE');
CREATE TYPE "ComparisonChangeType" AS ENUM ('NEW', 'REMOVED', 'CHANGED', 'UNCHANGED', 'CONFLICTED', 'UNKNOWN', 'NOT_COMPARABLE', 'NEWLY_CAPTURED');
CREATE TYPE "ComparisonEntityType" AS ENUM ('SYMPTOM', 'MEDICATION', 'ALLERGY', 'OBSERVATION', 'CLINICAL_HISTORY_FIELD', 'DOCUMENT', 'RISK_SIGNAL');
CREATE TYPE "MatchConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'NONE');

CREATE TABLE "PatientSnapshot" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "visitId" TEXT NOT NULL,
  "snapshotVersion" TEXT NOT NULL DEFAULT '1.0.0',
  "sourceRevision" TEXT NOT NULL,
  "snapshotHash" TEXT NOT NULL,
  "facts" JSONB NOT NULL,
  "eventCount" INTEGER NOT NULL,
  "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PatientSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Comparison" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "previousVisitId" TEXT NOT NULL,
  "currentVisitId" TEXT NOT NULL,
  "previousSnapshotId" TEXT NOT NULL,
  "currentSnapshotId" TEXT NOT NULL,
  "status" "ComparisonStatus" NOT NULL DEFAULT 'GENERATED',
  "engineVersion" TEXT NOT NULL,
  "cacheKey" TEXT NOT NULL,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "Comparison_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChangeRecord" (
  "id" TEXT NOT NULL,
  "comparisonId" TEXT NOT NULL,
  "entityType" "ComparisonEntityType" NOT NULL,
  "entityKey" TEXT NOT NULL,
  "changeType" "ComparisonChangeType" NOT NULL,
  "reason" TEXT NOT NULL,
  "fieldChanges" JSONB NOT NULL,
  "previousValue" JSONB,
  "currentValue" JSONB,
  "previousEventId" TEXT,
  "currentEventId" TEXT,
  "previousSource" "TimelineSource",
  "currentSource" "TimelineSource",
  "previousVerificationStatus" "TimelineEventStatus",
  "currentVerificationStatus" "TimelineEventStatus",
  "previousEvidence" JSONB,
  "currentEvidence" JSONB,
  "matchConfidence" "MatchConfidence" NOT NULL DEFAULT 'HIGH',
  "needsReview" BOOLEAN NOT NULL DEFAULT false,
  "explanation" TEXT NOT NULL,
  "relatedRiskSignalId" TEXT,
  "fingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChangeRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PatientSnapshot_snapshotHash_key" ON "PatientSnapshot"("snapshotHash");
CREATE UNIQUE INDEX "PatientSnapshot_patientId_visitId_sourceRevision_key" ON "PatientSnapshot"("patientId", "visitId", "sourceRevision");
CREATE INDEX "PatientSnapshot_patientId_generatedAt_idx" ON "PatientSnapshot"("patientId", "generatedAt");
CREATE INDEX "PatientSnapshot_visitId_sourceUpdatedAt_idx" ON "PatientSnapshot"("visitId", "sourceUpdatedAt");
CREATE UNIQUE INDEX "Comparison_cacheKey_key" ON "Comparison"("cacheKey");
CREATE INDEX "Comparison_patientId_createdAt_idx" ON "Comparison"("patientId", "createdAt");
CREATE INDEX "Comparison_previousVisitId_currentVisitId_idx" ON "Comparison"("previousVisitId", "currentVisitId");
CREATE INDEX "Comparison_status_createdAt_idx" ON "Comparison"("status", "createdAt");
CREATE UNIQUE INDEX "ChangeRecord_comparisonId_fingerprint_key" ON "ChangeRecord"("comparisonId", "fingerprint");
CREATE INDEX "ChangeRecord_comparisonId_changeType_idx" ON "ChangeRecord"("comparisonId", "changeType");
CREATE INDEX "ChangeRecord_comparisonId_entityType_idx" ON "ChangeRecord"("comparisonId", "entityType");
CREATE INDEX "ChangeRecord_comparisonId_needsReview_idx" ON "ChangeRecord"("comparisonId", "needsReview");
CREATE INDEX "ChangeRecord_previousEventId_idx" ON "ChangeRecord"("previousEventId");
CREATE INDEX "ChangeRecord_currentEventId_idx" ON "ChangeRecord"("currentEventId");
CREATE INDEX "ChangeRecord_relatedRiskSignalId_idx" ON "ChangeRecord"("relatedRiskSignalId");

ALTER TABLE "PatientSnapshot" ADD CONSTRAINT "PatientSnapshot_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientSnapshot" ADD CONSTRAINT "PatientSnapshot_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_previousVisitId_fkey" FOREIGN KEY ("previousVisitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_currentVisitId_fkey" FOREIGN KEY ("currentVisitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_previousSnapshotId_fkey" FOREIGN KEY ("previousSnapshotId") REFERENCES "PatientSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_currentSnapshotId_fkey" FOREIGN KEY ("currentSnapshotId") REFERENCES "PatientSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChangeRecord" ADD CONSTRAINT "ChangeRecord_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "Comparison"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChangeRecord" ADD CONSTRAINT "ChangeRecord_relatedRiskSignalId_fkey" FOREIGN KEY ("relatedRiskSignalId") REFERENCES "RiskSignal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
