DROP INDEX IF EXISTS "Visit_tokenNumber_key";

CREATE TYPE "QueueStatus" AS ENUM ('WAITING', 'CALLED', 'IN_CONSULTATION', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'SKIPPED');
CREATE TYPE "QueuePriority" AS ENUM ('NORMAL', 'PRIORITY_REVIEW');

CREATE TABLE "QueueCounter" (
  "id" TEXT NOT NULL,
  "queueKey" TEXT NOT NULL,
  "queueDate" DATE NOT NULL,
  "nextValue" INTEGER NOT NULL DEFAULT 1,
  "paused" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QueueCounter_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QueueCounter_queueKey_queueDate_key" ON "QueueCounter"("queueKey", "queueDate");

CREATE TABLE "QueueEntry" (
  "id" TEXT NOT NULL,
  "queueKey" TEXT NOT NULL,
  "queueDate" DATE NOT NULL,
  "sequence" INTEGER NOT NULL,
  "tokenNumber" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "visitId" TEXT NOT NULL,
  "doctorId" TEXT,
  "status" "QueueStatus" NOT NULL DEFAULT 'WAITING',
  "priority" "QueuePriority" NOT NULL DEFAULT 'NORMAL',
  "source" TEXT NOT NULL DEFAULT 'PATIENT_INTAKE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "calledAt" TIMESTAMP(3),
  "consultationStartedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QueueEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QueueEntry_visitId_key" ON "QueueEntry"("visitId");
CREATE UNIQUE INDEX "QueueEntry_queueKey_queueDate_sequence_key" ON "QueueEntry"("queueKey", "queueDate", "sequence");
CREATE INDEX "QueueEntry_queueKey_queueDate_status_priority_createdAt_idx" ON "QueueEntry"("queueKey", "queueDate", "status", "priority", "createdAt");
CREATE INDEX "QueueEntry_patientId_createdAt_idx" ON "QueueEntry"("patientId", "createdAt");
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "QueueEvent" (
  "id" TEXT NOT NULL,
  "tokenId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actorId" TEXT,
  "actorRole" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  CONSTRAINT "QueueEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "QueueEvent_tokenId_occurredAt_idx" ON "QueueEvent"("tokenId", "occurredAt");
ALTER TABLE "QueueEvent" ADD CONSTRAINT "QueueEvent_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "QueueEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
