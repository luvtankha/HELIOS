import type {
  BriefSectionType,
  TimelineEventStatus,
  TimelineSource,
} from "@prisma/client";

export interface BriefEvidence {
  kind:
    | "PATIENT"
    | "VISIT"
    | "INTERVIEW"
    | "SYMPTOM"
    | "MEDICATION"
    | "ALLERGY"
    | "OBSERVATION"
    | "TIMELINE_EVENT"
    | "DOCUMENT"
    | "DOCUMENT_FACT"
    | "COMPARISON"
    | "CHANGE_RECORD"
    | "RISK_SIGNAL"
    | "DOCTOR_VERIFICATION"
    | "AYUSH_RECORD"
    | "SYSTEM_AVAILABILITY";
  sourceId: string;
  label: string;
  eventDate?: string;
  documentId?: string;
  documentFactId?: string;
  timelineEventId?: string;
  comparisonId?: string;
  changeRecordId?: string;
  riskSignalId?: string;
  pageNumber?: number;
  sourceText?: string;
}

export interface BriefClaimDraft {
  claimKey: string;
  sectionType: BriefSectionType;
  position: number;
  text: string;
  structuredValue?: unknown;
  sourceType: string;
  sourceId: string;
  verificationStatus: TimelineEventStatus;
  confidence?: number;
  needsVerification: boolean;
  evidence: BriefEvidence[];
}

export interface BriefSectionDraft {
  sectionType: BriefSectionType;
  title: string;
  availability: "AVAILABLE" | "EMPTY" | "UNAVAILABLE";
  collapsible: boolean;
  defaultExpanded: boolean;
}

export interface BriefInput {
  patient: {
    id: string;
    fullName: string;
    patientCode: string;
    age: number;
    sex: string;
    preferredLanguage: string;
  };
  visit: {
    id: string;
    startedAt: Date;
    clinicalHistory?: {
      id: string;
      chiefComplaint?: string;
      duration?: unknown;
      location?: unknown;
      associatedSymptoms?: unknown;
      source: string;
      verificationStatus?: string;
    };
  };
  symptoms: Array<{
    id: string;
    name: string;
    severity?: string;
    duration?: unknown;
    location?: unknown;
    status?: string;
    source: string;
    verificationStatus?: string;
  }>;
  medications: Array<{
    id: string;
    name: string;
    dose?: string;
    frequency?: string;
    route?: string;
    visitId?: string;
    source: string;
    verifiedAt?: Date;
    verificationStatus?: string;
  }>;
  allergies: Array<{
    id: string;
    allergen: string;
    reaction?: string;
    severity?: string;
    source: string;
    verifiedAt?: Date;
    verificationStatus?: string;
  }>;
  observations: Array<{
    id: string;
    display: string;
    value?: unknown;
    unit?: string;
    state: string;
    source: string;
    effectiveAt?: Date;
    verificationStatus?: string;
  }>;
  ayushRecords: Array<{
    id: string;
    system: string;
    useStatus: string;
    originalName: string;
    normalizedName?: string;
    dosage?: string;
    frequency?: string;
    route?: string;
    indicationAsReported?: string;
    reportedEffect?: string;
    temporalRelationship?: string;
    startDate?: Date;
    source: string;
    verificationStatus?: string;
  }>;
  documents: Array<{
    id: string;
    fileName: string;
    documentType: string;
    documentDate?: Date;
    summary?: string;
    processingStatus: string;
    facts: Array<{
      id: string;
      factType: string;
      normalizedValue?: unknown;
      confidence?: number;
      status: string;
      verificationStatus?: string;
      evidence: Array<{ pageNumber: number; sourceText: string }>;
    }>;
  }>;
  history: Array<{
    id: string;
    title: string;
    description?: string;
    eventDate?: Date;
    source: TimelineSource;
    verificationStatus: TimelineEventStatus;
  }>;
  comparison?: {
    id: string;
    status?: string;
    changes: Array<{
      id: string;
      entityType: string;
      entityKey: string;
      changeType: string;
      fieldChanges: unknown;
      previousValue?: unknown;
      currentValue?: unknown;
      previousEvidence?: unknown;
      currentEvidence?: unknown;
      needsReview: boolean;
      explanation: string;
      previousVerificationStatus?: TimelineEventStatus;
      currentVerificationStatus?: TimelineEventStatus;
    }>;
  };
  safetyAvailable: boolean;
  riskSignals: Array<{
    id: string;
    title: string;
    description: string;
    category: string;
    severity: string;
    status: string;
    createdAt: Date;
  }>;
}

export interface BuiltBrief {
  sections: BriefSectionDraft[];
  claims: BriefClaimDraft[];
  sourceReferences: BriefEvidence[];
  narrative: string;
}
