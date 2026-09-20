CREATE TYPE "DocumentType" AS ENUM ('PRESCRIPTION', 'LAB_REPORT', 'DISCHARGE_SUMMARY', 'CONSULTATION_NOTE', 'UNKNOWN');
CREATE TYPE "DocumentFactStatus" AS ENUM ('EXTRACTED', 'NEEDS_REVIEW', 'CONFIRMED', 'REJECTED', 'VERIFIED');
CREATE TYPE "DocumentIdentityStatus" AS ENUM ('PENDING', 'MATCHED', 'IDENTITY_MISMATCH', 'NOT_PRESENT', 'MANUAL_OVERRIDE');

ALTER TYPE "DocumentStatus" RENAME TO "DocumentStatus_old";
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'VALIDATING', 'PREPROCESSING', 'OCR_PROCESSING', 'LAYOUT_PROCESSING', 'EXTRACTING', 'NORMALIZING', 'REVIEW_REQUIRED', 'VERIFIED', 'FAILED', 'CANCELLED');
ALTER TABLE "MedicalDocument" ALTER COLUMN "processingStatus" DROP DEFAULT;
ALTER TABLE "MedicalDocument" ALTER COLUMN "processingStatus" TYPE "DocumentStatus" USING (
  CASE "processingStatus"::text
    WHEN 'PROCESSING' THEN 'OCR_PROCESSING'
    WHEN 'PROCESSED' THEN 'REVIEW_REQUIRED'
    ELSE "processingStatus"::text
  END
)::"DocumentStatus";
ALTER TABLE "MedicalDocument" ALTER COLUMN "processingStatus" SET DEFAULT 'UPLOADED';
DROP TYPE "DocumentStatus_old";

ALTER TABLE "MedicalDocument"
ADD COLUMN "sessionId" TEXT,
ADD COLUMN "fileHash" TEXT,
ADD COLUMN "pageCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "identityStatus" "DocumentIdentityStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "documentDate" TIMESTAMP(3),
ADD COLUMN "summary" TEXT,
ADD COLUMN "deletedAt" TIMESTAMP(3);

INSERT INTO "PatientSession" (
  "id", "patientId", "status", "currentStep", "language",
  "startedAt", "lastActiveAt", "createdAt", "updatedAt"
)
SELECT
  'document-migration-' || "id", "patientId", 'IN_PROGRESS', 'REVIEW', 'en',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "MedicalDocument";
UPDATE "MedicalDocument"
SET "sessionId" = 'document-migration-' || "id"
WHERE "sessionId" IS NULL;
UPDATE "MedicalDocument" SET "fileHash" = md5("id" || ':' || "storagePath") WHERE "fileHash" IS NULL;
ALTER TABLE "MedicalDocument" ALTER COLUMN "sessionId" SET NOT NULL;
ALTER TABLE "MedicalDocument" ALTER COLUMN "fileHash" SET NOT NULL;
ALTER TABLE "MedicalDocument" ALTER COLUMN "documentType" DROP DEFAULT;
ALTER TABLE "MedicalDocument" ALTER COLUMN "documentType" TYPE "DocumentType" USING (
  CASE UPPER(COALESCE("documentType", 'UNKNOWN'))
    WHEN 'PRESCRIPTION' THEN 'PRESCRIPTION'
    WHEN 'LAB_REPORT' THEN 'LAB_REPORT'
    WHEN 'DISCHARGE_SUMMARY' THEN 'DISCHARGE_SUMMARY'
    WHEN 'CONSULTATION_NOTE' THEN 'CONSULTATION_NOTE'
    ELSE 'UNKNOWN'
  END
)::"DocumentType";
ALTER TABLE "MedicalDocument" ALTER COLUMN "documentType" SET NOT NULL;
ALTER TABLE "MedicalDocument" ALTER COLUMN "documentType" SET DEFAULT 'UNKNOWN';

ALTER TABLE "DocumentExtraction"
ADD COLUMN "model" TEXT,
ADD COLUMN "processingVersion" TEXT,
ADD COLUMN "errorCode" TEXT;

ALTER TABLE "TimelineEvent" ADD COLUMN "documentId" TEXT;

CREATE TABLE "DocumentPage" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "pageNumber" INTEGER NOT NULL,
  "processedImagePath" TEXT,
  "ocrText" TEXT,
  "width" INTEGER,
  "height" INTEGER,
  "confidence" DOUBLE PRECISION,
  "processingStatus" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentPage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentFact" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "visitId" TEXT,
  "factType" TEXT NOT NULL,
  "originalValue" JSONB NOT NULL,
  "normalizedValue" JSONB,
  "source" "ClinicalSource" NOT NULL DEFAULT 'DOCUMENT_EXTRACTED',
  "confidence" DOUBLE PRECISION,
  "status" "DocumentFactStatus" NOT NULL DEFAULT 'EXTRACTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentFact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentEvidence" (
  "id" TEXT NOT NULL,
  "documentFactId" TEXT NOT NULL,
  "pageId" TEXT,
  "pageNumber" INTEGER NOT NULL,
  "sourceText" TEXT NOT NULL,
  "boundingBox" JSONB,
  "confidence" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentProcessingJob" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
  "progress" INTEGER,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "errorCode" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentProcessingJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MedicalDocument_patientId_fileHash_key" ON "MedicalDocument"("patientId", "fileHash");
CREATE INDEX "MedicalDocument_sessionId_createdAt_idx" ON "MedicalDocument"("sessionId", "createdAt");
CREATE UNIQUE INDEX "DocumentPage_documentId_pageNumber_key" ON "DocumentPage"("documentId", "pageNumber");
CREATE INDEX "DocumentPage_documentId_processingStatus_idx" ON "DocumentPage"("documentId", "processingStatus");
CREATE INDEX "DocumentFact_documentId_status_idx" ON "DocumentFact"("documentId", "status");
CREATE INDEX "DocumentFact_patientId_factType_idx" ON "DocumentFact"("patientId", "factType");
CREATE INDEX "DocumentFact_visitId_idx" ON "DocumentFact"("visitId");
CREATE INDEX "DocumentEvidence_documentFactId_pageNumber_idx" ON "DocumentEvidence"("documentFactId", "pageNumber");
CREATE INDEX "DocumentEvidence_pageId_idx" ON "DocumentEvidence"("pageId");
CREATE INDEX "DocumentProcessingJob_documentId_createdAt_idx" ON "DocumentProcessingJob"("documentId", "createdAt");
CREATE INDEX "DocumentProcessingJob_status_createdAt_idx" ON "DocumentProcessingJob"("status", "createdAt");
CREATE UNIQUE INDEX "TimelineEvent_documentId_key" ON "TimelineEvent"("documentId");

ALTER TABLE "MedicalDocument" ADD CONSTRAINT "MedicalDocument_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PatientSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentPage" ADD CONSTRAINT "DocumentPage_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "MedicalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentFact" ADD CONSTRAINT "DocumentFact_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "MedicalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentFact" ADD CONSTRAINT "DocumentFact_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentFact" ADD CONSTRAINT "DocumentFact_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentEvidence" ADD CONSTRAINT "DocumentEvidence_documentFactId_fkey" FOREIGN KEY ("documentFactId") REFERENCES "DocumentFact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentEvidence" ADD CONSTRAINT "DocumentEvidence_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "DocumentPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentProcessingJob" ADD CONSTRAINT "DocumentProcessingJob_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "MedicalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "MedicalDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
