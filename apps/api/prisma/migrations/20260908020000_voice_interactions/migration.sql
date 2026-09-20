CREATE TYPE "VoiceInteractionStatus" AS ENUM (
  'RECORDING',
  'PROCESSING',
  'TRANSCRIBED',
  'CONFIRMED',
  'EDITED',
  'FAILED',
  'CANCELLED'
);

CREATE TABLE "VoiceInteraction" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "visitId" TEXT,
  "language" TEXT NOT NULL,
  "detectedLanguage" TEXT,
  "audioMetadata" JSONB,
  "originalTranscript" TEXT,
  "normalizedTranscript" TEXT,
  "patientEditedTranscript" TEXT,
  "acceptedTranscript" TEXT,
  "confidence" DOUBLE PRECISION,
  "provider" TEXT NOT NULL,
  "model" TEXT,
  "status" "VoiceInteractionStatus" NOT NULL DEFAULT 'RECORDING',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VoiceInteraction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VoiceInteraction_confidence_check"
    CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1))
);

CREATE INDEX "VoiceInteraction_sessionId_createdAt_idx"
  ON "VoiceInteraction"("sessionId", "createdAt");
CREATE INDEX "VoiceInteraction_visitId_createdAt_idx"
  ON "VoiceInteraction"("visitId", "createdAt");
CREATE INDEX "VoiceInteraction_status_createdAt_idx"
  ON "VoiceInteraction"("status", "createdAt");

ALTER TABLE "VoiceInteraction"
  ADD CONSTRAINT "VoiceInteraction_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "PatientSession"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VoiceInteraction"
  ADD CONSTRAINT "VoiceInteraction_visitId_fkey"
  FOREIGN KEY ("visitId") REFERENCES "Visit"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
