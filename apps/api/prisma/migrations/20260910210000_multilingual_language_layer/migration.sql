ALTER TABLE "User" ADD COLUMN "preferredLanguage" TEXT NOT NULL DEFAULT 'en';

ALTER TABLE "InterviewResponse"
  ADD COLUMN "originalLanguage" TEXT,
  ADD COLUMN "detectedLanguages" JSONB,
  ADD COLUMN "displayLanguage" TEXT,
  ADD COLUMN "displayText" TEXT;

ALTER TABLE "VoiceInteraction"
  ADD COLUMN "detectedLanguages" JSONB;

ALTER TABLE "MedicalDocument"
  ADD COLUMN "documentLanguage" TEXT,
  ADD COLUMN "detectedLanguages" JSONB;

ALTER TABLE "DocumentFact"
  ADD COLUMN "originalLanguage" TEXT,
  ADD COLUMN "displayTranslation" TEXT;
