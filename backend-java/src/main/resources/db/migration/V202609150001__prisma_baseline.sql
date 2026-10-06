-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

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
CREATE TYPE "ClinicalSource" AS ENUM ('PATIENT_REPORTED', 'AI_STRUCTURED', 'DOCUMENT_EXTRACTED', 'DOCTOR_ENTERED', 'AYUSH_PRACTITIONER_DOCUMENTED', 'DOCTOR_VERIFIED', 'SYSTEM_GENERATED');

-- CreateEnum
CREATE TYPE "AyushSystem" AS ENUM ('AYURVEDA', 'YOGA_NATUROPATHY', 'UNANI', 'SIDDHA', 'HOMOEOPATHY', 'OTHER_TRADITIONAL_SYSTEM', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AyushUseStatus" AS ENUM ('CURRENT', 'HISTORICAL', 'STOPPED', 'UNKNOWN', 'NOT_DOCUMENTED');

-- CreateEnum
CREATE TYPE "AyushTemporalRelationship" AS ENUM ('REPORTED_AFTER', 'DOCUMENTED_ALONGSIDE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "KnowledgeState" AS ENUM ('YES', 'NO', 'UNKNOWN', 'NOT_ASKED', 'NOT_APPLICABLE', 'CONFLICT');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'VALIDATING', 'PREPROCESSING', 'OCR_PROCESSING', 'LAYOUT_PROCESSING', 'EXTRACTING', 'NORMALIZING', 'REVIEW_REQUIRED', 'VERIFIED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PRESCRIPTION', 'LAB_REPORT', 'DISCHARGE_SUMMARY', 'CONSULTATION_NOTE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DocumentFactStatus" AS ENUM ('EXTRACTED', 'NEEDS_REVIEW', 'CONFIRMED', 'REJECTED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "DocumentIdentityStatus" AS ENUM ('PENDING', 'MATCHED', 'IDENTITY_MISMATCH', 'NOT_PRESENT', 'MANUAL_OVERRIDE');

-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'REVIEW_REQUIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "TimelineSource" AS ENUM ('PATIENT_REPORTED', 'VOICE_INTERVIEW', 'DOCUMENT_EXTRACTED', 'CLINICAL_RECORD', 'DOCTOR_VERIFIED', 'SYSTEM_GENERATED', 'SAFETY_ENGINE');

-- CreateEnum
CREATE TYPE "TimelineEventType" AS ENUM ('PATIENT_VISIT', 'PATIENT_REPORTED_SYMPTOM', 'CLINICAL_HISTORY_UPDATE', 'MEDICATION_RECORDED', 'MEDICATION_CHANGED', 'ALLERGY_RECORDED', 'LAB_RESULT', 'OBSERVATION', 'MEDICAL_DOCUMENT', 'CONSULTATION_NOTE', 'DISCHARGE_EVENT', 'PROCEDURE', 'DOCTOR_VERIFICATION', 'RISK_SIGNAL', 'AYUSH_TREATMENT');

-- CreateEnum
CREATE TYPE "TimelineDatePrecision" AS ENUM ('EXACT_DATE', 'MONTH_ONLY', 'YEAR_ONLY', 'DATE_RANGE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "TimelineEventStatus" AS ENUM ('DRAFT', 'CAPTURED', 'AI_STRUCTURED', 'DOCUMENT_EXTRACTED', 'PATIENT_CONFIRMED', 'DOCTOR_VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TimelineTemporalState" AS ENUM ('CURRENT', 'HISTORICAL', 'UNKNOWN', 'DISCONTINUED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "TimelineMedicationAction" AS ENUM ('STARTED', 'REPORTED', 'CHANGED', 'CONFIRMED', 'DISCONTINUED');

-- CreateEnum
CREATE TYPE "ComparisonStatus" AS ENUM ('GENERATED', 'REVIEWED', 'ARCHIVED', 'STALE');

-- CreateEnum
CREATE TYPE "ComparisonChangeType" AS ENUM ('NEW', 'REMOVED', 'CHANGED', 'UNCHANGED', 'CONFLICTED', 'UNKNOWN', 'NOT_COMPARABLE', 'NEWLY_CAPTURED');

-- CreateEnum
CREATE TYPE "ComparisonEntityType" AS ENUM ('SYMPTOM', 'MEDICATION', 'ALLERGY', 'OBSERVATION', 'CLINICAL_HISTORY_FIELD', 'DOCUMENT', 'RISK_SIGNAL', 'AYUSH_RECORD');

-- CreateEnum
CREATE TYPE "MatchConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'NONE');

-- CreateEnum
CREATE TYPE "ClinicalBriefStatus" AS ENUM ('GENERATED', 'REVIEWED', 'STALE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BriefSectionType" AS ENUM ('PATIENT_SNAPSHOT', 'TODAYS_REASON', 'CURRENT_SYMPTOMS', 'WHAT_CHANGED', 'RELEVANT_HISTORY', 'MEDICATIONS', 'ALLERGIES', 'INVESTIGATIONS', 'SAFETY_ATTENTION', 'NEEDS_VERIFICATION', 'SUPPORTING_DOCUMENTS', 'SOURCE_EVIDENCE', 'AYUSH_USE');

-- CreateEnum
CREATE TYPE "RiskSeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'DISMISSED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'PARTIALLY_CORRECT', 'EDITED', 'REJECTED', 'MISSED', 'UNREVIEWED', 'PATIENT_REPORTED', 'AI_STRUCTURED', 'DOCUMENT_EXTRACTED', 'NEEDS_REVIEW', 'DOCTOR_VERIFIED', 'DOCTOR_CORRECTED', 'DOCTOR_REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "VerificationAction" AS ENUM ('VERIFY', 'CORRECT', 'REJECT', 'MARK_UNCERTAIN', 'CONFIRM_CURRENT', 'KEEP_PREVIOUS', 'SUPERSEDE');

-- CreateEnum
CREATE TYPE "VerificationFactType" AS ENUM ('CLINICAL_HISTORY', 'SYMPTOM', 'MEDICATION', 'ALLERGY', 'OBSERVATION', 'DOCUMENT_FACT', 'INTERVIEW_RESPONSE', 'AYUSH_RECORD');

-- CreateEnum
CREATE TYPE "VoiceInteractionStatus" AS ENUM ('RECORDING', 'PROCESSING', 'TRANSCRIBED', 'CONFIRMED', 'EDITED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('ACTIVE', 'REVIEW', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "InterviewResponseStatus" AS ENUM ('CAPTURED', 'STRUCTURED', 'CONFIRMED', 'NEEDS_CLARIFICATION');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('WAITING', 'CALLED', 'IN_CONSULTATION', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'SKIPPED');

-- CreateEnum
CREATE TYPE "QueuePriority" AS ENUM ('NORMAL', 'PRIORITY_REVIEW');

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Specialization" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "aliases" TEXT[],
    "description" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "providerType" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Specialization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalConditionSpecialization" (
    "id" TEXT NOT NULL,
    "conditionName" TEXT NOT NULL,
    "primarySpecializationId" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "datasetVersion" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalConditionSpecialization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutingDecision" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "datasetVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoutingDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "specializationId" TEXT NOT NULL DEFAULT 'unclassified',
    "acceptingRouting" BOOLEAN NOT NULL DEFAULT false,
    "id" TEXT NOT NULL,
    "email" TEXT,
    "username" TEXT,
    "displayName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
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
    "preferredDoctorId" TEXT,
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
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "pathway" TEXT NOT NULL,
    "questionGraphVersion" TEXT NOT NULL DEFAULT 'phase4-v1',
    "state" JSONB NOT NULL,
    "currentQuestionId" TEXT,
    "completeness" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "InterviewStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewResponse" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "rawAnswer" TEXT NOT NULL,
    "originalLanguage" TEXT,
    "detectedLanguages" JSONB,
    "displayLanguage" TEXT,
    "displayText" TEXT,
    "normalizedAnswer" JSONB,
    "language" TEXT NOT NULL,
    "source" "ClinicalSource" NOT NULL DEFAULT 'PATIENT_REPORTED',
    "confidence" DOUBLE PRECISION,
    "status" "InterviewResponseStatus" NOT NULL DEFAULT 'CAPTURED',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PATIENT_REPORTED',
    "verificationVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "VoiceInteraction" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "visitId" TEXT,
    "language" TEXT NOT NULL,
    "detectedLanguage" TEXT,
    "detectedLanguages" JSONB,
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

    CONSTRAINT "VoiceInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Observation" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "visitId" TEXT,
    "conceptKey" TEXT NOT NULL,
    "display" TEXT NOT NULL,
    "codeSystem" TEXT,
    "code" TEXT,
    "category" TEXT,
    "value" JSONB,
    "unit" TEXT,
    "referenceRange" JSONB,
    "state" "KnowledgeState" NOT NULL DEFAULT 'YES',
    "status" TEXT NOT NULL DEFAULT 'FINAL',
    "effectiveAt" TIMESTAMP(3),
    "source" "ClinicalSource" NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNREVIEWED',
    "verificationVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Observation_pkey" PRIMARY KEY ("id")
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
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PATIENT_REPORTED',
    "verificationVersion" INTEGER NOT NULL DEFAULT 0,
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
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PATIENT_REPORTED',
    "verificationVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

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
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PATIENT_REPORTED',
    "verificationVersion" INTEGER NOT NULL DEFAULT 0,
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
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PATIENT_REPORTED',
    "verificationVersion" INTEGER NOT NULL DEFAULT 0,
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
    "sessionId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileHash" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL DEFAULT 'UNKNOWN',
    "pageCount" INTEGER NOT NULL DEFAULT 1,
    "identityStatus" "DocumentIdentityStatus" NOT NULL DEFAULT 'PENDING',
    "documentDate" TIMESTAMP(3),
    "summary" TEXT,
    "documentLanguage" TEXT,
    "detectedLanguages" JSONB,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT NOT NULL,
    "processingStatus" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "deletedAt" TIMESTAMP(3),
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
    "model" TEXT,
    "processingVersion" TEXT,
    "errorCode" TEXT,
    "status" "ExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "DocumentFact" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "visitId" TEXT,
    "factType" TEXT NOT NULL,
    "originalValue" JSONB NOT NULL,
    "normalizedValue" JSONB,
    "originalLanguage" TEXT,
    "displayTranslation" TEXT,
    "source" "ClinicalSource" NOT NULL DEFAULT 'DOCUMENT_EXTRACTED',
    "confidence" DOUBLE PRECISION,
    "status" "DocumentFactStatus" NOT NULL DEFAULT 'EXTRACTED',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'DOCUMENT_EXTRACTED',
    "verificationVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AyushRecord" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "visitId" TEXT,
    "interviewId" TEXT,
    "documentId" TEXT,
    "documentFactId" TEXT,
    "system" "AyushSystem" NOT NULL,
    "useStatus" "AyushUseStatus" NOT NULL DEFAULT 'UNKNOWN',
    "practitionerName" TEXT,
    "practitionerRegistrationId" TEXT,
    "facilityName" TEXT,
    "treatmentName" TEXT,
    "medicineName" TEXT,
    "originalName" TEXT NOT NULL,
    "normalizedName" TEXT,
    "ingredients" JSONB,
    "dosage" TEXT,
    "frequency" TEXT,
    "route" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "indicationAsReported" TEXT,
    "patientReportedReason" TEXT,
    "reportedEffect" TEXT,
    "reportedEffectOnset" TIMESTAMP(3),
    "temporalRelationship" "AyushTemporalRelationship",
    "originalStatement" TEXT,
    "source" "ClinicalSource" NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
    "verificationVersion" INTEGER NOT NULL DEFAULT 0,
    "evidenceReferences" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AyushRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "TimelineEvent" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "visitId" TEXT,
    "documentId" TEXT,
    "documentFactId" TEXT,
    "eventType" "TimelineEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventDate" TIMESTAMP(3),
    "eventEndDate" TIMESTAMP(3),
    "datePrecision" "TimelineDatePrecision" NOT NULL DEFAULT 'UNKNOWN',
    "temporalState" "TimelineTemporalState" NOT NULL DEFAULT 'UNKNOWN',
    "medicationAction" "TimelineMedicationAction",
    "source" "TimelineSource" NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceText" TEXT,
    "temporalText" TEXT,
    "pageNumber" INTEGER,
    "verificationStatus" "TimelineEventStatus" NOT NULL DEFAULT 'CAPTURED',
    "confidence" DOUBLE PRECISION,
    "originalValue" JSONB,
    "normalizedValue" JSONB,
    "groupKey" TEXT,
    "normalizedKey" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "conflictKey" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineEventVersion" (
    "id" TEXT NOT NULL,
    "timelineEventId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changeReason" TEXT NOT NULL,

    CONSTRAINT "TimelineEventVersion_pkey" PRIMARY KEY ("id")
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
    "patientId" TEXT NOT NULL,
    "visitId" TEXT,
    "factType" "VerificationFactType" NOT NULL,
    "factId" TEXT NOT NULL,
    "action" "VerificationAction" NOT NULL,
    "previousStatus" "VerificationStatus" NOT NULL,
    "newStatus" "VerificationStatus" NOT NULL,
    "originalValue" JSONB NOT NULL,
    "verifiedValue" JSONB NOT NULL,
    "status" "VerificationStatus" NOT NULL,
    "sourceType" "ClinicalSource" NOT NULL,
    "evidenceReferences" JSONB NOT NULL,
    "reason" TEXT,
    "comment" TEXT,
    "verifiedBy" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "factVersion" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

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

-- CreateTable
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

-- CreateTable
CREATE TABLE "DoctorPatientAssignment" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoctorPatientAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueCounter" (
    "id" TEXT NOT NULL,
    "queueKey" TEXT NOT NULL,
    "queueDate" DATE NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QueueCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "PatientSnapshot" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "snapshotVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "sourceRevision" TEXT NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "facts" JSONB NOT NULL,
    "eventCount" INTEGER NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comparison" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "previousVisitId" TEXT NOT NULL,
    "currentVisitId" TEXT NOT NULL,
    "previousSnapshotId" TEXT NOT NULL,
    "currentSnapshotId" TEXT NOT NULL,
    "status" "ComparisonStatus" NOT NULL DEFAULT 'GENERATED',
    "engineVersion" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Comparison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeRecord" (
    "id" TEXT NOT NULL,
    "comparisonId" TEXT NOT NULL,
    "entityType" "ComparisonEntityType" NOT NULL,
    "entityKey" TEXT NOT NULL,
    "changeType" "ComparisonChangeType" NOT NULL,
    "reason" TEXT NOT NULL,
    "fieldChanges" JSONB NOT NULL,
    "previousValue" JSONB,
    "currentValue" JSONB,
    "previousEventId" TEXT,
    "currentEventId" TEXT,
    "previousSource" "TimelineSource",
    "currentSource" "TimelineSource",
    "previousVerificationStatus" "TimelineEventStatus",
    "currentVerificationStatus" "TimelineEventStatus",
    "previousEvidence" JSONB,
    "currentEvidence" JSONB,
    "matchConfidence" "MatchConfidence" NOT NULL DEFAULT 'HIGH',
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "explanation" TEXT NOT NULL,
    "relatedRiskSignalId" TEXT,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalBrief" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "comparisonId" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatorVersion" TEXT NOT NULL,
    "sourceRevision" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ClinicalBriefStatus" NOT NULL DEFAULT 'GENERATED',
    "sections" JSONB NOT NULL,
    "sourceReferences" JSONB NOT NULL,
    "createdBy" TEXT,
    "previousVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "ClinicalBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BriefClaim" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "sectionType" "BriefSectionType" NOT NULL,
    "position" INTEGER NOT NULL,
    "claimKey" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "structuredValue" JSONB,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "evidenceReferences" JSONB NOT NULL,
    "verificationStatus" "TimelineEventStatus" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "needsVerification" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BriefClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_key_key" ON "SystemConfig"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Specialization_displayName_key" ON "Specialization"("displayName");

-- CreateIndex
CREATE INDEX "MedicalConditionSpecialization_active_primarySpecialization_idx" ON "MedicalConditionSpecialization"("active", "primarySpecializationId");

-- CreateIndex
CREATE INDEX "RoutingDecision_sessionId_createdAt_idx" ON "RoutingDecision"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "RoutingDecision_visitId_createdAt_idx" ON "RoutingDecision"("visitId", "createdAt");

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
CREATE INDEX "Visit_patientId_status_idx" ON "Visit"("patientId", "status");

-- CreateIndex
CREATE INDEX "Visit_status_createdAt_idx" ON "Visit"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Visit_startedAt_idx" ON "Visit"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Interview_sessionId_key" ON "Interview"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Interview_visitId_key" ON "Interview"("visitId");

-- CreateIndex
CREATE INDEX "Interview_status_updatedAt_idx" ON "Interview"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "Interview_pathway_status_idx" ON "Interview"("pathway", "status");

-- CreateIndex
CREATE INDEX "InterviewResponse_interviewId_createdAt_idx" ON "InterviewResponse"("interviewId", "createdAt");

-- CreateIndex
CREATE INDEX "InterviewResponse_interviewId_questionId_idx" ON "InterviewResponse"("interviewId", "questionId");

-- CreateIndex
CREATE INDEX "InterviewResponse_status_createdAt_idx" ON "InterviewResponse"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AIInteraction_interviewId_createdAt_idx" ON "AIInteraction"("interviewId", "createdAt");

-- CreateIndex
CREATE INDEX "AIInteraction_validationStatus_createdAt_idx" ON "AIInteraction"("validationStatus", "createdAt");

-- CreateIndex
CREATE INDEX "VoiceInteraction_sessionId_createdAt_idx" ON "VoiceInteraction"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "VoiceInteraction_visitId_createdAt_idx" ON "VoiceInteraction"("visitId", "createdAt");

-- CreateIndex
CREATE INDEX "VoiceInteraction_status_createdAt_idx" ON "VoiceInteraction"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Observation_patientId_effectiveAt_idx" ON "Observation"("patientId", "effectiveAt");

-- CreateIndex
CREATE INDEX "Observation_visitId_category_idx" ON "Observation"("visitId", "category");

-- CreateIndex
CREATE INDEX "Observation_conceptKey_effectiveAt_idx" ON "Observation"("conceptKey", "effectiveAt");

-- CreateIndex
CREATE INDEX "Observation_source_createdAt_idx" ON "Observation"("source", "createdAt");

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
CREATE INDEX "MedicalDocument_sessionId_createdAt_idx" ON "MedicalDocument"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalDocument_patientId_fileHash_key" ON "MedicalDocument"("patientId", "fileHash");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentExtraction_documentId_key" ON "DocumentExtraction"("documentId");

-- CreateIndex
CREATE INDEX "DocumentExtraction_status_createdAt_idx" ON "DocumentExtraction"("status", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentPage_documentId_processingStatus_idx" ON "DocumentPage"("documentId", "processingStatus");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentPage_documentId_pageNumber_key" ON "DocumentPage"("documentId", "pageNumber");

-- CreateIndex
CREATE INDEX "DocumentFact_documentId_status_idx" ON "DocumentFact"("documentId", "status");

-- CreateIndex
CREATE INDEX "DocumentFact_patientId_factType_idx" ON "DocumentFact"("patientId", "factType");

-- CreateIndex
CREATE INDEX "DocumentFact_visitId_idx" ON "DocumentFact"("visitId");

-- CreateIndex
CREATE UNIQUE INDEX "AyushRecord_interviewId_key" ON "AyushRecord"("interviewId");

-- CreateIndex
CREATE UNIQUE INDEX "AyushRecord_documentFactId_key" ON "AyushRecord"("documentFactId");

-- CreateIndex
CREATE INDEX "AyushRecord_patientId_useStatus_createdAt_idx" ON "AyushRecord"("patientId", "useStatus", "createdAt");

-- CreateIndex
CREATE INDEX "AyushRecord_visitId_system_idx" ON "AyushRecord"("visitId", "system");

-- CreateIndex
CREATE INDEX "AyushRecord_system_verificationStatus_idx" ON "AyushRecord"("system", "verificationStatus");

-- CreateIndex
CREATE INDEX "AyushRecord_documentId_idx" ON "AyushRecord"("documentId");

-- CreateIndex
CREATE INDEX "AyushRecord_source_createdAt_idx" ON "AyushRecord"("source", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentEvidence_documentFactId_pageNumber_idx" ON "DocumentEvidence"("documentFactId", "pageNumber");

-- CreateIndex
CREATE INDEX "DocumentEvidence_pageId_idx" ON "DocumentEvidence"("pageId");

-- CreateIndex
CREATE INDEX "DocumentProcessingJob_documentId_createdAt_idx" ON "DocumentProcessingJob"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentProcessingJob_status_createdAt_idx" ON "DocumentProcessingJob"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TimelineEvent_fingerprint_key" ON "TimelineEvent"("fingerprint");

-- CreateIndex
CREATE INDEX "TimelineEvent_patientId_eventDate_recordedAt_idx" ON "TimelineEvent"("patientId", "eventDate", "recordedAt");

-- CreateIndex
CREATE INDEX "TimelineEvent_patientId_eventType_eventDate_idx" ON "TimelineEvent"("patientId", "eventType", "eventDate");

-- CreateIndex
CREATE INDEX "TimelineEvent_patientId_source_eventDate_idx" ON "TimelineEvent"("patientId", "source", "eventDate");

-- CreateIndex
CREATE INDEX "TimelineEvent_patientId_verificationStatus_eventDate_idx" ON "TimelineEvent"("patientId", "verificationStatus", "eventDate");

-- CreateIndex
CREATE INDEX "TimelineEvent_visitId_eventDate_idx" ON "TimelineEvent"("visitId", "eventDate");

-- CreateIndex
CREATE INDEX "TimelineEvent_documentId_eventDate_idx" ON "TimelineEvent"("documentId", "eventDate");

-- CreateIndex
CREATE INDEX "TimelineEvent_documentFactId_idx" ON "TimelineEvent"("documentFactId");

-- CreateIndex
CREATE INDEX "TimelineEvent_groupKey_eventDate_idx" ON "TimelineEvent"("groupKey", "eventDate");

-- CreateIndex
CREATE INDEX "TimelineEvent_conflictKey_idx" ON "TimelineEvent"("conflictKey");

-- CreateIndex
CREATE INDEX "TimelineEvent_createdAt_idx" ON "TimelineEvent"("createdAt");

-- CreateIndex
CREATE INDEX "TimelineEventVersion_timelineEventId_changedAt_idx" ON "TimelineEventVersion"("timelineEventId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TimelineEventVersion_timelineEventId_version_key" ON "TimelineEventVersion"("timelineEventId", "version");

-- CreateIndex
CREATE INDEX "RiskSignal_visitId_status_idx" ON "RiskSignal"("visitId", "status");

-- CreateIndex
CREATE INDEX "RiskSignal_severity_status_idx" ON "RiskSignal"("severity", "status");

-- CreateIndex
CREATE INDEX "RiskSignal_createdAt_idx" ON "RiskSignal"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorVerification_idempotencyKey_key" ON "DoctorVerification"("idempotencyKey");

-- CreateIndex
CREATE INDEX "DoctorVerification_patientId_newStatus_verifiedAt_idx" ON "DoctorVerification"("patientId", "newStatus", "verifiedAt");

-- CreateIndex
CREATE INDEX "DoctorVerification_visitId_newStatus_idx" ON "DoctorVerification"("visitId", "newStatus");

-- CreateIndex
CREATE INDEX "DoctorVerification_factType_factId_verifiedAt_idx" ON "DoctorVerification"("factType", "factId", "verifiedAt");

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

-- CreateIndex
CREATE INDEX "DoctorNote_patientId_createdAt_idx" ON "DoctorNote"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "DoctorNote_visitId_createdAt_idx" ON "DoctorNote"("visitId", "createdAt");

-- CreateIndex
CREATE INDEX "DoctorNote_authorId_createdAt_idx" ON "DoctorNote"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "DoctorPatientAssignment_patientId_active_idx" ON "DoctorPatientAssignment"("patientId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorPatientAssignment_doctorId_patientId_key" ON "DoctorPatientAssignment"("doctorId", "patientId");

-- CreateIndex
CREATE UNIQUE INDEX "QueueCounter_queueKey_queueDate_key" ON "QueueCounter"("queueKey", "queueDate");

-- CreateIndex
CREATE UNIQUE INDEX "QueueEntry_visitId_key" ON "QueueEntry"("visitId");

-- CreateIndex
CREATE INDEX "QueueEntry_queueKey_queueDate_status_priority_createdAt_idx" ON "QueueEntry"("queueKey", "queueDate", "status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "QueueEntry_patientId_createdAt_idx" ON "QueueEntry"("patientId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QueueEntry_queueKey_queueDate_sequence_key" ON "QueueEntry"("queueKey", "queueDate", "sequence");

-- CreateIndex
CREATE INDEX "QueueEvent_tokenId_occurredAt_idx" ON "QueueEvent"("tokenId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "PatientSnapshot_snapshotHash_key" ON "PatientSnapshot"("snapshotHash");

-- CreateIndex
CREATE INDEX "PatientSnapshot_patientId_generatedAt_idx" ON "PatientSnapshot"("patientId", "generatedAt");

-- CreateIndex
CREATE INDEX "PatientSnapshot_visitId_sourceUpdatedAt_idx" ON "PatientSnapshot"("visitId", "sourceUpdatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PatientSnapshot_patientId_visitId_sourceRevision_key" ON "PatientSnapshot"("patientId", "visitId", "sourceRevision");

-- CreateIndex
CREATE UNIQUE INDEX "Comparison_cacheKey_key" ON "Comparison"("cacheKey");

-- CreateIndex
CREATE INDEX "Comparison_patientId_createdAt_idx" ON "Comparison"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "Comparison_previousVisitId_currentVisitId_idx" ON "Comparison"("previousVisitId", "currentVisitId");

-- CreateIndex
CREATE INDEX "Comparison_status_createdAt_idx" ON "Comparison"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ChangeRecord_comparisonId_changeType_idx" ON "ChangeRecord"("comparisonId", "changeType");

-- CreateIndex
CREATE INDEX "ChangeRecord_comparisonId_entityType_idx" ON "ChangeRecord"("comparisonId", "entityType");

-- CreateIndex
CREATE INDEX "ChangeRecord_comparisonId_needsReview_idx" ON "ChangeRecord"("comparisonId", "needsReview");

-- CreateIndex
CREATE INDEX "ChangeRecord_previousEventId_idx" ON "ChangeRecord"("previousEventId");

-- CreateIndex
CREATE INDEX "ChangeRecord_currentEventId_idx" ON "ChangeRecord"("currentEventId");

-- CreateIndex
CREATE INDEX "ChangeRecord_relatedRiskSignalId_idx" ON "ChangeRecord"("relatedRiskSignalId");

-- CreateIndex
CREATE UNIQUE INDEX "ChangeRecord_comparisonId_fingerprint_key" ON "ChangeRecord"("comparisonId", "fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalBrief_cacheKey_key" ON "ClinicalBrief"("cacheKey");

-- CreateIndex
CREATE INDEX "ClinicalBrief_patientId_visitId_createdAt_idx" ON "ClinicalBrief"("patientId", "visitId", "createdAt");

-- CreateIndex
CREATE INDEX "ClinicalBrief_status_createdAt_idx" ON "ClinicalBrief"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ClinicalBrief_comparisonId_idx" ON "ClinicalBrief"("comparisonId");

-- CreateIndex
CREATE INDEX "ClinicalBrief_previousVersionId_idx" ON "ClinicalBrief"("previousVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalBrief_patientId_visitId_sourceRevision_generatorVer_key" ON "ClinicalBrief"("patientId", "visitId", "sourceRevision", "generatorVersion");

-- CreateIndex
CREATE INDEX "BriefClaim_briefId_sectionType_position_idx" ON "BriefClaim"("briefId", "sectionType", "position");

-- CreateIndex
CREATE INDEX "BriefClaim_sourceType_sourceId_idx" ON "BriefClaim"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "BriefClaim_needsVerification_idx" ON "BriefClaim"("needsVerification");

-- CreateIndex
CREATE UNIQUE INDEX "BriefClaim_briefId_claimKey_key" ON "BriefClaim"("briefId", "claimKey");

-- AddForeignKey
ALTER TABLE "MedicalConditionSpecialization" ADD CONSTRAINT "MedicalConditionSpecialization_primarySpecializationId_fkey" FOREIGN KEY ("primarySpecializationId") REFERENCES "Specialization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingDecision" ADD CONSTRAINT "RoutingDecision_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PatientSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingDecision" ADD CONSTRAINT "RoutingDecision_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_specializationId_fkey" FOREIGN KEY ("specializationId") REFERENCES "Specialization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientProfile" ADD CONSTRAINT "PatientProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientSession" ADD CONSTRAINT "PatientSession_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientSession" ADD CONSTRAINT "PatientSession_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_preferredDoctorId_fkey" FOREIGN KEY ("preferredDoctorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PatientSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewResponse" ADD CONSTRAINT "InterviewResponse_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIInteraction" ADD CONSTRAINT "AIInteraction_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceInteraction" ADD CONSTRAINT "VoiceInteraction_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PatientSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceInteraction" ADD CONSTRAINT "VoiceInteraction_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "MedicalDocument" ADD CONSTRAINT "MedicalDocument_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PatientSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentExtraction" ADD CONSTRAINT "DocumentExtraction_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "MedicalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentPage" ADD CONSTRAINT "DocumentPage_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "MedicalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFact" ADD CONSTRAINT "DocumentFact_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "MedicalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFact" ADD CONSTRAINT "DocumentFact_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFact" ADD CONSTRAINT "DocumentFact_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AyushRecord" ADD CONSTRAINT "AyushRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AyushRecord" ADD CONSTRAINT "AyushRecord_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AyushRecord" ADD CONSTRAINT "AyushRecord_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AyushRecord" ADD CONSTRAINT "AyushRecord_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "MedicalDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AyushRecord" ADD CONSTRAINT "AyushRecord_documentFactId_fkey" FOREIGN KEY ("documentFactId") REFERENCES "DocumentFact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentEvidence" ADD CONSTRAINT "DocumentEvidence_documentFactId_fkey" FOREIGN KEY ("documentFactId") REFERENCES "DocumentFact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentEvidence" ADD CONSTRAINT "DocumentEvidence_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "DocumentPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentProcessingJob" ADD CONSTRAINT "DocumentProcessingJob_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "MedicalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "MedicalDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_documentFactId_fkey" FOREIGN KEY ("documentFactId") REFERENCES "DocumentFact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEventVersion" ADD CONSTRAINT "TimelineEventVersion_timelineEventId_fkey" FOREIGN KEY ("timelineEventId") REFERENCES "TimelineEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskSignal" ADD CONSTRAINT "RiskSignal_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorVerification" ADD CONSTRAINT "DoctorVerification_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorVerification" ADD CONSTRAINT "DoctorVerification_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorVerification" ADD CONSTRAINT "DoctorVerification_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PatientSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorNote" ADD CONSTRAINT "DoctorNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorNote" ADD CONSTRAINT "DoctorNote_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorNote" ADD CONSTRAINT "DoctorNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorPatientAssignment" ADD CONSTRAINT "DoctorPatientAssignment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorPatientAssignment" ADD CONSTRAINT "DoctorPatientAssignment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEvent" ADD CONSTRAINT "QueueEvent_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "QueueEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientSnapshot" ADD CONSTRAINT "PatientSnapshot_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientSnapshot" ADD CONSTRAINT "PatientSnapshot_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_previousVisitId_fkey" FOREIGN KEY ("previousVisitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_currentVisitId_fkey" FOREIGN KEY ("currentVisitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_previousSnapshotId_fkey" FOREIGN KEY ("previousSnapshotId") REFERENCES "PatientSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_currentSnapshotId_fkey" FOREIGN KEY ("currentSnapshotId") REFERENCES "PatientSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comparison" ADD CONSTRAINT "Comparison_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRecord" ADD CONSTRAINT "ChangeRecord_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "Comparison"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRecord" ADD CONSTRAINT "ChangeRecord_relatedRiskSignalId_fkey" FOREIGN KEY ("relatedRiskSignalId") REFERENCES "RiskSignal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalBrief" ADD CONSTRAINT "ClinicalBrief_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalBrief" ADD CONSTRAINT "ClinicalBrief_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalBrief" ADD CONSTRAINT "ClinicalBrief_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "Comparison"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalBrief" ADD CONSTRAINT "ClinicalBrief_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalBrief" ADD CONSTRAINT "ClinicalBrief_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "ClinicalBrief"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefClaim" ADD CONSTRAINT "BriefClaim_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "ClinicalBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;
