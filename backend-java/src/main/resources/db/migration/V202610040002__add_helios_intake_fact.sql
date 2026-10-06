CREATE TABLE "HeliosIntakeFact" (
    "id" TEXT PRIMARY KEY,
    "patientSessionId" TEXT NOT NULL,
    "field" VARCHAR(96) NOT NULL,
    "value" TEXT NULL,
    "knowledgeState" VARCHAR(32) NOT NULL,
    "confidence" VARCHAR(32) NULL,
    "source" VARCHAR(48) NOT NULL,
    "evidenceTurnIds" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "modelVersion" TEXT NULL,
    "conversationPolicyVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HeliosIntakeFact_patientSessionId_fkey"
        FOREIGN KEY ("patientSessionId") REFERENCES "PatientSession"("id") ON DELETE CASCADE,
    CONSTRAINT "HeliosIntakeFact_patientSessionId_field_key"
        UNIQUE ("patientSessionId", "field")
);

CREATE INDEX "HeliosIntakeFact_session_updated_idx"
    ON "HeliosIntakeFact"("patientSessionId", "updatedAt");

CREATE INDEX "HeliosIntakeFact_session_state_idx"
    ON "HeliosIntakeFact"("patientSessionId", "knowledgeState");
