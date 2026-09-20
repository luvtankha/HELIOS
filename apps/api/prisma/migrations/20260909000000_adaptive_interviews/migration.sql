CREATE TYPE "InterviewStatus" AS ENUM ('ACTIVE', 'REVIEW', 'COMPLETED', 'ABANDONED');
CREATE TYPE "InterviewResponseStatus" AS ENUM ('CAPTURED', 'STRUCTURED', 'CONFIRMED', 'NEEDS_CLARIFICATION');

CREATE TABLE "Interview" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "visitId" TEXT NOT NULL,
  "pathway" TEXT NOT NULL,
  "state" JSONB NOT NULL,
  "currentQuestionId" TEXT,
  "completeness" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" "InterviewStatus" NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Interview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Interview_completeness_check" CHECK ("completeness" >= 0 AND "completeness" <= 1)
);
CREATE UNIQUE INDEX "Interview_sessionId_key" ON "Interview"("sessionId");
CREATE UNIQUE INDEX "Interview_visitId_key" ON "Interview"("visitId");
CREATE INDEX "Interview_status_updatedAt_idx" ON "Interview"("status", "updatedAt");
CREATE INDEX "Interview_pathway_status_idx" ON "Interview"("pathway", "status");

CREATE TABLE "InterviewResponse" (
  "id" TEXT NOT NULL,
  "interviewId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "rawAnswer" TEXT NOT NULL,
  "normalizedAnswer" JSONB,
  "language" TEXT NOT NULL,
  "source" "ClinicalSource" NOT NULL DEFAULT 'PATIENT_REPORTED',
  "confidence" DOUBLE PRECISION,
  "status" "InterviewResponseStatus" NOT NULL DEFAULT 'CAPTURED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedAt" TIMESTAMP(3),
  CONSTRAINT "InterviewResponse_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InterviewResponse_confidence_check" CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1))
);
CREATE INDEX "InterviewResponse_interviewId_createdAt_idx" ON "InterviewResponse"("interviewId", "createdAt");
CREATE INDEX "InterviewResponse_interviewId_questionId_idx" ON "InterviewResponse"("interviewId", "questionId");
CREATE INDEX "InterviewResponse_status_createdAt_idx" ON "InterviewResponse"("status", "createdAt");

CREATE TABLE "AIInteraction" (
  "id" TEXT NOT NULL,
  "interviewId" TEXT NOT NULL,
  "responseId" TEXT,
  "provider" TEXT NOT NULL,
  "model" TEXT,
  "inputType" TEXT NOT NULL,
  "validationStatus" TEXT NOT NULL,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "latencyMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AIInteraction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AIInteraction_interviewId_createdAt_idx" ON "AIInteraction"("interviewId", "createdAt");
CREATE INDEX "AIInteraction_validationStatus_createdAt_idx" ON "AIInteraction"("validationStatus", "createdAt");

ALTER TABLE "Interview" ADD CONSTRAINT "Interview_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PatientSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InterviewResponse" ADD CONSTRAINT "InterviewResponse_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIInteraction" ADD CONSTRAINT "AIInteraction_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
