CREATE TABLE "Specialization" (
 "id" TEXT PRIMARY KEY, "displayName" TEXT NOT NULL UNIQUE, "aliases" TEXT[] NOT NULL,
 "description" TEXT NOT NULL, "source" TEXT NOT NULL, "providerType" TEXT NOT NULL,
 "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
INSERT INTO "Specialization" ("id","displayName","aliases","description","source","providerType","updatedAt") VALUES
 ('unclassified','Specialty unverified',ARRAY[]::TEXT[],'Provider qualifications have not been configured.','https://www.certificationmatters.org/boards/','unknown',CURRENT_TIMESTAMP);
ALTER TABLE "User" ADD COLUMN "specializationId" TEXT NOT NULL DEFAULT 'unclassified', ADD COLUMN "acceptingRouting" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD CONSTRAINT "User_specializationId_fkey" FOREIGN KEY ("specializationId") REFERENCES "Specialization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Visit" ADD COLUMN "preferredDoctorId" TEXT;
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_preferredDoctorId_fkey" FOREIGN KEY ("preferredDoctorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE TABLE "MedicalConditionSpecialization" (
 "id" TEXT PRIMARY KEY, "conditionName" TEXT NOT NULL, "primarySpecializationId" TEXT NOT NULL,
 "definition" JSONB NOT NULL, "datasetVersion" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "MedicalConditionSpecialization_primarySpecializationId_fkey" FOREIGN KEY ("primarySpecializationId") REFERENCES "Specialization"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "MedicalConditionSpecialization_active_primarySpecializationId_idx" ON "MedicalConditionSpecialization"("active","primarySpecializationId");
CREATE TABLE "RoutingDecision" (
 "id" TEXT PRIMARY KEY, "sessionId" TEXT NOT NULL, "visitId" TEXT NOT NULL,
 "inputHash" TEXT NOT NULL, "input" JSONB NOT NULL, "result" JSONB NOT NULL, "datasetVersion" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "RoutingDecision_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PatientSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "RoutingDecision_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "RoutingDecision_sessionId_createdAt_idx" ON "RoutingDecision"("sessionId","createdAt");
CREATE INDEX "RoutingDecision_visitId_createdAt_idx" ON "RoutingDecision"("visitId","createdAt");
