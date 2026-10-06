CREATE TABLE "HeliosVoiceSession" (
    "id" TEXT PRIMARY KEY,
    "patientSessionId" TEXT NOT NULL,
    "visitId" TEXT NULL,
    "state" VARCHAR(32) NOT NULL,
    "doctorAvatarId" TEXT NOT NULL,
    "lastAcknowledgedSequence" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HeliosVoiceSession_patientSessionId_fkey"
        FOREIGN KEY ("patientSessionId") REFERENCES "PatientSession"("id") ON DELETE CASCADE,
    CONSTRAINT "HeliosVoiceSession_visitId_fkey"
        FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL,
    CONSTRAINT "HeliosVoiceSession_ack_nonnegative"
        CHECK ("lastAcknowledgedSequence" >= 0)
);

CREATE INDEX "HeliosVoiceSession_patientSessionId_createdAt_idx"
    ON "HeliosVoiceSession"("patientSessionId", "createdAt");

CREATE INDEX "HeliosVoiceSession_state_updatedAt_idx"
    ON "HeliosVoiceSession"("state", "updatedAt");
