-- Phase 13 doctor-only consultation notes. Original patient and extracted
-- source records remain separate and are never overwritten by these notes.
CREATE TABLE "DoctorNote" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "visitId" TEXT,
  "authorId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DoctorNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DoctorNote_patientId_createdAt_idx" ON "DoctorNote"("patientId", "createdAt");
CREATE INDEX "DoctorNote_visitId_createdAt_idx" ON "DoctorNote"("visitId", "createdAt");
CREATE INDEX "DoctorNote_authorId_createdAt_idx" ON "DoctorNote"("authorId", "createdAt");

ALTER TABLE "DoctorNote"
  ADD CONSTRAINT "DoctorNote_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DoctorNote"
  ADD CONSTRAINT "DoctorNote_visitId_fkey"
  FOREIGN KEY ("visitId") REFERENCES "Visit"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DoctorNote"
  ADD CONSTRAINT "DoctorNote_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
