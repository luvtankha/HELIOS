import type {
  ClinicalSource,
  VerificationAction,
  VerificationFactType,
  VerificationStatus,
} from "@prisma/client";

export interface VerificationEvidence {
  kind: "DOCUMENT" | "INTERVIEW" | "VOICE" | "CLINICAL_RECORD";
  sourceId: string;
  label: string;
  sourceText?: string;
  language?: string;
  normalizedValue?: unknown;
  documentId?: string;
  documentName?: string;
  pageNumber?: number;
  boundingBox?: unknown;
  occurredAt?: Date;
}

export interface ReviewableFact {
  factType: VerificationFactType;
  factId: string;
  patientId: string;
  patientName: string;
  patientCode: string;
  visitId?: string;
  visitDate?: Date;
  label: string;
  value: unknown;
  sourceType: ClinicalSource;
  verificationStatus: VerificationStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  confidence?: number;
  evidence: VerificationEvidence[];
  normalizedKey?: string;
}

export interface VerificationMutation {
  patientId: string;
  factType: VerificationFactType;
  factId: string;
  action: VerificationAction;
  expectedVersion: number;
  idempotencyKey: string;
  doctorId: string;
  reason?: string;
  comment?: string;
  correctedValue?: Record<string, unknown>;
  evidenceReferences: VerificationEvidence[];
  requestId?: string;
}
