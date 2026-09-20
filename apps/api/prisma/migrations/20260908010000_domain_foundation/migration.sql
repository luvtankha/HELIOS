-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PATIENT', 'DOCTOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PatientSex" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "PatientSessionStatus" AS ENUM ('STARTED', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "PatientFlowStep" AS ENUM ('WELCOME', 'LANGUAGE', 'CONSENT', 'BASIC_INFO', 'CHIEF_COMPLAINT', 'INTERVIEW', 'REVIEW', 'SUBMITTED', 'COMPLETE');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('WAITING', 'IN_PROGRESS', 'READY_FOR_DOCTOR', 'UNDER_REVIEW', 'VERIFIED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VisitType" AS ENUM ('PRE_CONSULTATION', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "ClinicalSource" AS ENUM ('PATIENT_REPORTED', 'AI_STRUCTURED', 'DOCTOR_VERIFIED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'PROCESSED', 'REVIEW_REQUIRED', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'REVIEW_REQUIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "TimelineSource" AS ENUM ('PATIENT_REPORTED', 'DOCUMENT', 'AI_EXTRACTED', 'DOCTOR_VERIFIED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "RiskSeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'DISMISSED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'EDITED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "username" TEXT,
    "displayName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "patientCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "sex" "PatientSex" NOT NULL,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientSession" (
    "id" TEXT NOT NULL,
    "patientId" TEXT,
    "visitId" TEXT,
    "status" "PatientSessionStatus" NOT NULL DEFAULT 'STARTED',
    "currentStep" "PatientFlowStep" NOT NULL DEFAULT 'WELCOME',
    "language" TEXT NOT NULL DEFAULT 'en',
    "draftData" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "tokenNumber" TEXT,
    "status" "VisitStatus" NOT NULL DEFAULT 'WAITING',
    "visitType" "VisitType" NOT NULL DEFAULT 'PRE_CONSULTATION',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalHistory" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "chiefComplaint" TEXT NOT NULL,
    "onset" JSONB,
    "duration" JSONB,
    "severity" TEXT,
    "location" JSONB,
    "character" JSONB,
    "timing" JSONB,
    "aggravatingFactors" JSONB,
    "relievingFactors" JSONB,
    "associatedSymptoms" JSONB,
    "pastMedicalHistory" JSONB,
    "pastSurgicalHistory" JSONB,
    "currentMedications" JSONB,
    "allergies" JSONB,
    "familyHistory" JSONB,
    "socialHistory" JSONB,
    "reviewOfSystems" JSONB,
    "additionalNotes" TEXT,
    "source" "ClinicalSource" NOT NULL DEFAULT 'PATIENT_REPORTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Symptom" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT,
    "severity" TEXT,
    "duration" JSONB,
    "location" JSONB,
    "onset" JSONB,
    "status" TEXT,
    "source" "ClinicalSource" NOT NULL DEFAULT 'PATIENT_REPORTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Symptom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medication" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "visitId" TEXT,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT,
    "dose" TEXT,
    "frequency" TEXT,
    "route" TEXT,
    "source" "ClinicalSource" NOT NULL DEFAULT 'PATIENT_REPORTED',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Medication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allergy" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "visitId" TEXT,
    "allergen" TEXT NOT NULL,
    "reaction" TEXT,
    "severity" TEXT,
    "source" "ClinicalSource" NOT NULL DEFAULT 'PATIENT_REPORTED',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Allergy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalDocument" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "visitId" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "documentType" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT NOT NULL,
    "processingStatus" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentExtraction" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "rawText" TEXT,
    "structuredData" JSONB,
    "confidence" DOUBLE PRECISION,
    "provider" TEXT,
    "status" "ExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineEvent" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "visitId" TEXT,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "source" "TimelineSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskSignal" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" "RiskSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" "RiskStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "RiskSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorVerification" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "originalValue" JSONB NOT NULL,
    "verifiedValue" JSONB NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedBy" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "DoctorVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "patientId" TEXT,
    "sessionId" TEXT NOT NULL,
    "consentType" TEXT NOT NULL,
    "accepted" BOOLEAN NOT NULL,
    "version" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PatientProfile_userId_key" ON "PatientProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PatientProfile_patientCode_key" ON "PatientProfile"("patientCode");

-- CreateIndex
CREATE INDEX "PatientProfile_createdAt_idx" ON "PatientProfile"("createdAt");

-- CreateIndex
CREATE INDEX "PatientProfile_fullName_idx" ON "PatientProfile"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "PatientSession_visitId_key" ON "PatientSession"("visitId");

-- CreateIndex
CREATE INDEX "PatientSession_patientId_status_idx" ON "PatientSession"("patientId", "status");

-- CreateIndex
CREATE INDEX "PatientSession_status_lastActiveAt_idx" ON "PatientSession"("status", "lastActiveAt");

-- CreateIndex
CREATE INDEX "PatientSession_createdAt_idx" ON "PatientSession"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Visit_tokenNumber_key" ON "Visit"("tokenNumber");

-- CreateIndex
CREATE INDEX "Visit_patientId_status_idx" ON "Visit"("patientId", "status");

-- CreateIndex
CREATE INDEX "Visit_status_createdAt_idx" ON "Visit"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Visit_startedAt_idx" ON "Visit"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalHistory_visitId_key" ON "ClinicalHistory"("visitId");

-- CreateIndex
CREATE INDEX "ClinicalHistory_createdAt_idx" ON "ClinicalHistory"("createdAt");

-- CreateIndex
CREATE INDEX "Symptom_visitId_source_idx" ON "Symptom"("visitId", "source");

-- CreateIndex
CREATE INDEX "Symptom_normalizedName_idx" ON "Symptom"("normalizedName");

-- CreateIndex
CREATE INDEX "Symptom_createdAt_idx" ON "Symptom"("createdAt");

-- CreateIndex
CREATE INDEX "Medication_patientId_createdAt_idx" ON "Medication"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "Medication_visitId_idx" ON "Medication"("visitId");

-- CreateIndex
CREATE INDEX "Medication_normalizedName_idx" ON "Medication"("normalizedName");

-- CreateIndex
CREATE INDEX "Allergy_patientId_createdAt_idx" ON "Allergy"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "Allergy_visitId_idx" ON "Allergy"("visitId");

-- CreateIndex
CREATE INDEX "Allergy_allergen_idx" ON "Allergy"("allergen");

-- CreateIndex
CREATE INDEX "MedicalDocument_patientId_uploadedAt_idx" ON "MedicalDocument"("patientId", "uploadedAt");

-- CreateIndex
CREATE INDEX "MedicalDocument_visitId_processingStatus_idx" ON "MedicalDocument"("visitId", "processingStatus");

-- CreateIndex
CREATE INDEX "MedicalDocument_processingStatus_createdAt_idx" ON "MedicalDocument"("processingStatus", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentExtraction_documentId_key" ON "DocumentExtraction"("documentId");

-- CreateIndex
CREATE INDEX "DocumentExtraction_status_createdAt_idx" ON "DocumentExtraction"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TimelineEvent_patientId_eventDate_idx" ON "TimelineEvent"("patientId", "eventDate");

-- CreateIndex
CREATE INDEX "TimelineEvent_visitId_idx" ON "TimelineEvent"("visitId");

-- CreateIndex
CREATE INDEX "TimelineEvent_eventType_eventDate_idx" ON "TimelineEvent"("eventType", "eventDate");

-- CreateIndex
CREATE INDEX "TimelineEvent_createdAt_idx" ON "TimelineEvent"("createdAt");

-- CreateIndex
CREATE INDEX "RiskSignal_visitId_status_idx" ON "RiskSignal"("visitId", "status");

-- CreateIndex
CREATE INDEX "RiskSignal_severity_status_idx" ON "RiskSignal"("severity", "status");

-- CreateIndex
CREATE INDEX "RiskSignal_createdAt_idx" ON "RiskSignal"("createdAt");

-- CreateIndex
CREATE INDEX "DoctorVerification_visitId_status_idx" ON "DoctorVerification"("visitId", "status");

-- CreateIndex
CREATE INDEX "DoctorVerification_entityType_entityId_idx" ON "DoctorVerification"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "DoctorVerification_verifiedBy_verifiedAt_idx" ON "DoctorVerification"("verifiedBy", "verifiedAt");

-- CreateIndex
CREATE INDEX "ConsentRecord_patientId_acceptedAt_idx" ON "ConsentRecord"("patientId", "acceptedAt");

-- CreateIndex
CREATE INDEX "ConsentRecord_sessionId_accepted_idx" ON "ConsentRecord"("sessionId", "accepted");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentRecord_sessionId_consentType_version_key" ON "ConsentRecord"("sessionId", "consentType", "version");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "PatientProfile" ADD CONSTRAINT "PatientProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientSession" ADD CONSTRAINT "PatientSession_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientSession" ADD CONSTRAINT "PatientSession_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalHistory" ADD CONSTRAINT "ClinicalHistory_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Symptom" ADD CONSTRAINT "Symptom_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medication" ADD CONSTRAINT "Medication_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medication" ADD CONSTRAINT "Medication_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allergy" ADD CONSTRAINT "Allergy_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allergy" ADD CONSTRAINT "Allergy_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalDocument" ADD CONSTRAINT "MedicalDocument_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalDocument" ADD CONSTRAINT "MedicalDocument_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentExtraction" ADD CONSTRAINT "DocumentExtraction_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "MedicalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskSignal" ADD CONSTRAINT "RiskSignal_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorVerification" ADD CONSTRAINT "DoctorVerification_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorVerification" ADD CONSTRAINT "DoctorVerification_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PatientSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Domain integrity checks not expressible in the Prisma schema language.
ALTER TABLE "User" ADD CONSTRAINT "User_identity_required" CHECK ("email" IS NOT NULL OR "username" IS NOT NULL);
ALTER TABLE "PatientProfile" ADD CONSTRAINT "PatientProfile_age_range" CHECK ("age" >= 0 AND "age" <= 120);
ALTER TABLE "MedicalDocument" ADD CONSTRAINT "MedicalDocument_fileSize_nonnegative" CHECK ("fileSize" >= 0);
ALTER TABLE "DocumentExtraction" ADD CONSTRAINT "DocumentExtraction_confidence_range" CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1));
