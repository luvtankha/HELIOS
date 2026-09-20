-- PostgreSQL requires enum additions to commit before a later transaction
-- can use them in column defaults or data migrations. Keep this separate from
-- the doctor-verification migration for fresh installs.
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'UNREVIEWED';
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'PATIENT_REPORTED';
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'AI_STRUCTURED';
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'DOCUMENT_EXTRACTED';
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'NEEDS_REVIEW';
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'DOCTOR_VERIFIED';
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'DOCTOR_CORRECTED';
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'DOCTOR_REJECTED';
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'SUPERSEDED';
