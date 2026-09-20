export interface ApiErrorDetail {
  code: string;
  message: string;
  requestId?: string;
  details?: unknown;
}

export type ApiResponse<T> =
  { success: true; data: T } | { success: false; error: ApiErrorDetail };

export enum UserRole {
  Patient = "PATIENT",
  Doctor = "DOCTOR",
  Admin = "ADMIN",
}

export enum PatientStatus {
  Started = "STARTED",
  InProgress = "IN_PROGRESS",
  ReadyForReview = "READY_FOR_REVIEW",
  Completed = "COMPLETED",
  Abandoned = "ABANDONED",
}

export enum VisitStatus {
  Waiting = "WAITING",
  InProgress = "IN_PROGRESS",
  ReadyForDoctor = "READY_FOR_DOCTOR",
  UnderReview = "UNDER_REVIEW",
  Verified = "VERIFIED",
  Completed = "COMPLETED",
  Cancelled = "CANCELLED",
}

export enum DocumentStatus {
  Uploaded = "UPLOADED",
  Validating = "VALIDATING",
  Preprocessing = "PREPROCESSING",
  OcrProcessing = "OCR_PROCESSING",
  LayoutProcessing = "LAYOUT_PROCESSING",
  Extracting = "EXTRACTING",
  Normalizing = "NORMALIZING",
  ReviewRequired = "REVIEW_REQUIRED",
  Verified = "VERIFIED",
  Failed = "FAILED",
  Cancelled = "CANCELLED",
}

export type DocumentType =
  | "PRESCRIPTION"
  | "LAB_REPORT"
  | "DISCHARGE_SUMMARY"
  | "CONSULTATION_NOTE"
  | "UNKNOWN";

export type DocumentFactStatus =
  "EXTRACTED" | "NEEDS_REVIEW" | "CONFIRMED" | "REJECTED" | "VERIFIED";

export type DocumentIdentityStatus =
  | "PENDING"
  | "MATCHED"
  | "IDENTITY_MISMATCH"
  | "NOT_PRESENT"
  | "MANUAL_OVERRIDE";

export interface BoundingBoxDto {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DocumentEvidenceDto {
  id: string;
  pageNumber: number;
  sourceText: string;
  boundingBox?: BoundingBoxDto;
  confidence?: number;
}

export interface DocumentFactDto {
  id: string;
  factType: string;
  originalValue: unknown;
  normalizedValue?: unknown;
  source: "DOCUMENT_EXTRACTED";
  confidenceBand: "HIGH" | "MEDIUM" | "LOW";
  status: DocumentFactStatus;
  originalLanguage?: string;
  displayTranslation?: string;
  evidence: DocumentEvidenceDto[];
}

export interface DocumentPageDto {
  id: string;
  pageNumber: number;
  width?: number;
  height?: number;
  confidenceBand: "HIGH" | "MEDIUM" | "LOW";
}

export interface MedicalDocumentDto {
  id: string;
  patientId: string;
  visitId?: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  documentType: DocumentType;
  processingStatus: `${DocumentStatus}`;
  progress?: number;
  identityStatus: DocumentIdentityStatus;
  documentDate?: string;
  summary?: string;
  pageCount: number;
  pages: DocumentPageDto[];
  facts: DocumentFactDto[];
  documentLanguage?: string;
  detectedLanguages?: string[];
  uploadedAt: string;
  errorCode?: string;
}

/** Lightweight processing state used while a document is being prepared. */
export interface DocumentProcessingStatusDto {
  id: string;
  status: MedicalDocumentDto["processingStatus"];
  progress?: number;
  errorCode?: string;
}

export type TimelineEventType =
  | "PATIENT_VISIT"
  | "PATIENT_REPORTED_SYMPTOM"
  | "CLINICAL_HISTORY_UPDATE"
  | "MEDICATION_RECORDED"
  | "MEDICATION_CHANGED"
  | "ALLERGY_RECORDED"
  | "LAB_RESULT"
  | "OBSERVATION"
  | "MEDICAL_DOCUMENT"
  | "CONSULTATION_NOTE"
  | "DISCHARGE_EVENT"
  | "PROCEDURE"
  | "DOCTOR_VERIFICATION"
  | "RISK_SIGNAL"
  | "AYUSH_TREATMENT";

export type TimelineSource =
  | "PATIENT_REPORTED"
  | "VOICE_INTERVIEW"
  | "DOCUMENT_EXTRACTED"
  | "CLINICAL_RECORD"
  | "DOCTOR_VERIFIED"
  | "SYSTEM_GENERATED"
  | "SAFETY_ENGINE";

export type TimelineVerificationStatus =
  | "DRAFT"
  | "CAPTURED"
  | "AI_STRUCTURED"
  | "DOCUMENT_EXTRACTED"
  | "PATIENT_CONFIRMED"
  | "DOCTOR_VERIFIED"
  | "REJECTED";

export type TimelineDatePrecision =
  "EXACT_DATE" | "MONTH_ONLY" | "YEAR_ONLY" | "DATE_RANGE" | "UNKNOWN";

export type TimelineTemporalState =
  "CURRENT" | "HISTORICAL" | "UNKNOWN" | "DISCONTINUED" | "NOT_APPLICABLE";

export type TimelineMedicationAction =
  "STARTED" | "REPORTED" | "CHANGED" | "CONFIRMED" | "DISCONTINUED";

export interface TimelineEvidenceDto {
  documentId: string;
  documentFactId?: string;
  pageNumber?: number;
  sourceText?: string;
  boundingBox?: BoundingBoxDto;
}

export interface TimelineEventDto {
  id: string;
  eventType: TimelineEventType;
  title: string;
  description?: string;
  eventDate?: string;
  eventEndDate?: string;
  recordedAt: string;
  datePrecision: TimelineDatePrecision;
  temporalState: TimelineTemporalState;
  medicationAction?: TimelineMedicationAction;
  source: TimelineSource;
  sourceLabel: string;
  sourceType: string;
  sourceId: string;
  temporalText?: string;
  visitId?: string;
  documentId?: string;
  verificationStatus: TimelineVerificationStatus;
  confidenceBand: ConfidenceBand;
  groupKey?: string;
  hasConflict: boolean;
  evidence?: TimelineEvidenceDto;
}

export interface TimelineGroupDto {
  key: string;
  label: string;
  eventDate?: string;
  datePrecision: TimelineDatePrecision;
  events: TimelineEventDto[];
}

export interface TimelinePageDto {
  groups: TimelineGroupDto[];
  nextCursor?: string;
}

export interface TimelineEventDetailDto {
  event: TimelineEventDto;
  relatedVisit?: { id: string; status: string; startedAt: string };
  relatedDocument?: {
    id: string;
    fileName: string;
    documentType: DocumentType;
  };
  evidence?: TimelineEvidenceDto;
  versions: Array<{
    version: number;
    changedAt: string;
    changeReason: string;
  }>;
}

export type ComparisonStatus = "GENERATED" | "REVIEWED" | "ARCHIVED" | "STALE";
export type ComparisonChangeType =
  | "NEW"
  | "REMOVED"
  | "CHANGED"
  | "UNCHANGED"
  | "CONFLICTED"
  | "UNKNOWN"
  | "NOT_COMPARABLE"
  | "NEWLY_CAPTURED";
export type ComparisonEntityType =
  | "SYMPTOM"
  | "MEDICATION"
  | "ALLERGY"
  | "OBSERVATION"
  | "CLINICAL_HISTORY_FIELD"
  | "DOCUMENT"
  | "RISK_SIGNAL"
  | "AYUSH_RECORD";
export type MatchConfidence = "HIGH" | "MEDIUM" | "LOW" | "NONE";

export interface ComparisonEvidenceDto {
  timelineEventId: string;
  source: TimelineSource;
  verificationStatus: TimelineVerificationStatus;
  eventDate?: string;
  documentId?: string;
  documentFactId?: string;
  pageNumber?: number;
  sourceText?: string;
  boundingBox?: BoundingBoxDto;
}

export interface FieldChangeDto {
  field: string;
  previous?: unknown;
  current?: unknown;
  unit?: string;
  absoluteDelta?: number;
  percentageChange?: number;
}

export interface ChangeRecordDto {
  id: string;
  entityType: ComparisonEntityType;
  entityKey: string;
  changeType: ComparisonChangeType;
  reason: string;
  fieldChanges: FieldChangeDto[];
  previousValue?: unknown;
  currentValue?: unknown;
  previousSource?: TimelineSource;
  currentSource?: TimelineSource;
  previousVerificationStatus?: TimelineVerificationStatus;
  currentVerificationStatus?: TimelineVerificationStatus;
  previousEvidence?: ComparisonEvidenceDto;
  currentEvidence?: ComparisonEvidenceDto;
  matchConfidence: MatchConfidence;
  needsReview: boolean;
  explanation: string;
  relatedRiskSignalId?: string;
}

export interface ComparisonSummaryDto {
  newCount: number;
  changedCount: number;
  removedCount: number;
  conflictCount: number;
  unknownCount: number;
  unchangedCount: number;
  newlyCapturedCount: number;
  notComparableCount: number;
  needsReviewCount: number;
}

export interface ComparisonDto {
  id: string;
  patientId: string;
  patientName: string;
  previousVisitId: string;
  currentVisitId: string;
  previousVisitDate: string;
  currentVisitDate: string;
  previousSnapshotId: string;
  currentSnapshotId: string;
  status: ComparisonStatus;
  engineVersion: string;
  createdAt: string;
  summary: ComparisonSummaryDto;
  changes: ChangeRecordDto[];
}

export interface ComparisonListItemDto {
  id: string;
  previousVisitId: string;
  currentVisitId: string;
  previousVisitDate: string;
  currentVisitDate: string;
  status: ComparisonStatus;
  engineVersion: string;
  createdAt: string;
  summary: ComparisonSummaryDto;
}

export interface DoctorSessionDto {
  doctorId: string;
  displayName: string;
  role: "DOCTOR" | "ADMIN";
  doctorToken: string;
}

export type ClinicalBriefStatus =
  "GENERATED" | "REVIEWED" | "STALE" | "ARCHIVED";
export type BriefSectionType =
  | "PATIENT_SNAPSHOT"
  | "TODAYS_REASON"
  | "CURRENT_SYMPTOMS"
  | "WHAT_CHANGED"
  | "RELEVANT_HISTORY"
  | "MEDICATIONS"
  | "ALLERGIES"
  | "INVESTIGATIONS"
  | "SAFETY_ATTENTION"
  | "NEEDS_VERIFICATION"
  | "SUPPORTING_DOCUMENTS"
  | "SOURCE_EVIDENCE"
  | "AYUSH_USE";

export interface BriefEvidenceReferenceDto {
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

export interface BriefClaimDto {
  id: string;
  claimKey: string;
  sectionType: BriefSectionType;
  text: string;
  structuredValue?: unknown;
  sourceType: string;
  sourceId: string;
  verificationStatus: TimelineVerificationStatus;
  confidenceBand: ConfidenceBand;
  needsVerification: boolean;
  evidence: BriefEvidenceReferenceDto[];
}

export interface BriefSectionDto {
  sectionType: BriefSectionType;
  title: string;
  availability: "AVAILABLE" | "EMPTY" | "UNAVAILABLE";
  collapsible: boolean;
  defaultExpanded: boolean;
  claims: BriefClaimDto[];
}

export interface ClinicalBriefDto {
  id: string;
  patientId: string;
  patientName: string;
  patientCode: string;
  age: number;
  sex: PatientSex;
  preferredLanguage: string;
  visitId: string;
  visitDate: string;
  comparisonId?: string;
  status: ClinicalBriefStatus;
  version: number;
  generatorVersion: string;
  generatedAt: string;
  narrative: string;
  sections: BriefSectionDto[];
  claimCount: number;
}

export interface ClinicalBriefListItemDto {
  id: string;
  patientId: string;
  visitId: string;
  visitDate: string;
  status: ClinicalBriefStatus;
  version: number;
  generatorVersion: string;
  generatedAt: string;
  claimCount: number;
}

export enum VerificationStatus {
  Pending = "PENDING",
  Verified = "VERIFIED",
  PartiallyCorrect = "PARTIALLY_CORRECT",
  Edited = "EDITED",
  Rejected = "REJECTED",
  Missed = "MISSED",
  Unreviewed = "UNREVIEWED",
  PatientReported = "PATIENT_REPORTED",
  AiStructured = "AI_STRUCTURED",
  DocumentExtracted = "DOCUMENT_EXTRACTED",
  NeedsReview = "NEEDS_REVIEW",
  DoctorVerified = "DOCTOR_VERIFIED",
  DoctorCorrected = "DOCTOR_CORRECTED",
  DoctorRejected = "DOCTOR_REJECTED",
  Superseded = "SUPERSEDED",
}

export type ClinicalVerificationStatus =
  | "UNREVIEWED"
  | "PATIENT_REPORTED"
  | "AI_STRUCTURED"
  | "DOCUMENT_EXTRACTED"
  | "NEEDS_REVIEW"
  | "DOCTOR_VERIFIED"
  | "DOCTOR_CORRECTED"
  | "DOCTOR_REJECTED"
  | "SUPERSEDED";

export type VerificationAction =
  | "VERIFY"
  | "CORRECT"
  | "REJECT"
  | "MARK_UNCERTAIN"
  | "CONFIRM_CURRENT"
  | "KEEP_PREVIOUS"
  | "SUPERSEDE";

export type VerificationFactType =
  | "CLINICAL_HISTORY"
  | "SYMPTOM"
  | "MEDICATION"
  | "ALLERGY"
  | "OBSERVATION"
  | "DOCUMENT_FACT"
  | "INTERVIEW_RESPONSE"
  | "AYUSH_RECORD";

export interface VerificationEvidenceDto {
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
  occurredAt?: string;
}

export interface VerificationValueDto {
  value: unknown;
  sourceType: string;
  verificationStatus: ClinicalVerificationStatus;
  recordedAt: string;
  label?: string;
}

export interface VerificationHistoryDto {
  id: string;
  action: VerificationAction;
  previousStatus: string;
  newStatus: string;
  originalValue: unknown;
  verifiedValue: unknown;
  reason?: string;
  comment?: string;
  doctorName: string;
  verifiedAt: string;
  factVersion: number;
}

export interface VerificationQueueItemDto {
  reviewId: string;
  patientId: string;
  patientName: string;
  patientCode: string;
  visitId?: string;
  visitDate?: string;
  factType: VerificationFactType;
  factId: string;
  label: string;
  value: unknown;
  sourceType: string;
  verificationStatus: ClinicalVerificationStatus;
  version: number;
  workflowPriority: number;
  conflict: boolean;
  bulkEligible: boolean;
  evidenceAvailable: boolean;
}

export interface VerificationReviewDto extends VerificationQueueItemDto {
  evidence: VerificationEvidenceDto[];
  previous?: VerificationValueDto;
  history: VerificationHistoryDto[];
  safetySignalCount: number;
}

export interface VerificationMetricsDto {
  needsReview: number;
  conflicts: number;
  verifiedToday: number;
  correctedToday: number;
  rejectedToday: number;
}

export interface VerificationQueueDto {
  items: VerificationQueueItemDto[];
  metrics: VerificationMetricsDto;
  nextCursor?: string;
}

export interface VerificationActionResultDto {
  verification: VerificationHistoryDto;
  review: VerificationReviewDto;
  dependentRefreshPending: boolean;
  message: string;
}

export type AyushSystem =
  | "AYURVEDA"
  | "YOGA_NATUROPATHY"
  | "UNANI"
  | "SIDDHA"
  | "HOMOEOPATHY"
  | "OTHER_TRADITIONAL_SYSTEM"
  | "UNKNOWN";

export type AyushUseStatus =
  "CURRENT" | "HISTORICAL" | "STOPPED" | "UNKNOWN" | "NOT_DOCUMENTED";

export type AyushSourceType =
  | "PATIENT_REPORTED"
  | "DOCUMENT_EXTRACTED"
  | "DOCTOR_ENTERED"
  | "AYUSH_PRACTITIONER_DOCUMENTED"
  | "AI_STRUCTURED";

export interface AyushEvidenceDto {
  kind: "INTERVIEW" | "DOCUMENT" | "CLINICAL_RECORD";
  sourceId: string;
  label: string;
  sourceText?: string;
  language?: string;
  normalizedValue?: unknown;
  documentId?: string;
  documentName?: string;
  pageNumber?: number;
  boundingBox?: unknown;
  occurredAt?: string;
}

export interface AyushRecordDto {
  id: string;
  patientId: string;
  visitId?: string;
  system: AyushSystem;
  useStatus: AyushUseStatus;
  practitionerName?: string;
  practitionerRegistrationId?: string;
  facilityName?: string;
  treatmentName?: string;
  medicineName?: string;
  originalName: string;
  normalizedName?: string;
  ingredients?: string[];
  dosage?: string;
  frequency?: string;
  route?: string;
  startDate?: string;
  endDate?: string;
  indicationAsReported?: string;
  patientReportedReason?: string;
  reportedEffect?: string;
  reportedEffectOnset?: string;
  temporalRelationship?: "REPORTED_AFTER" | "DOCUMENTED_ALONGSIDE" | "UNKNOWN";
  originalStatement?: string;
  sourceType: AyushSourceType;
  verificationStatus: ClinicalVerificationStatus;
  verificationVersion: number;
  evidence: AyushEvidenceDto[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AyushPatientViewDto {
  patient: { id: string; fullName: string; patientCode: string };
  records: AyushRecordDto[];
  conventionalMedications: Array<{
    id: string;
    name: string;
    dose?: string;
    frequency?: string;
    verificationStatus: ClinicalVerificationStatus;
  }>;
  existingSafetySignals: Array<{
    id: string;
    title: string;
    status: string;
    source: string;
  }>;
  concurrentUseIdentified: boolean;
  interactionInformation: "VALIDATED_SIGNAL_AVAILABLE" | "UNAVAILABLE";
}

export type PatientFlowStep =
  | "WELCOME"
  | "LANGUAGE"
  | "CONSENT"
  | "BASIC_INFO"
  | "CHIEF_COMPLAINT"
  | "INTERVIEW"
  | "REVIEW"
  | "SUBMITTED"
  | "COMPLETE";

export type PatientSex = "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";

export interface PatientDetailsDto {
  id: string;
  patientCode: string;
  fullName: string;
  age: number;
  sex: PatientSex;
  preferredLanguage: string;
  phone?: string;
}

export interface VisitDto {
  id: string;
  tokenNumber?: string;
  status: string;
  chiefComplaint?: string;
  healthDetails?: Record<string, string>;
  startedAt: string;
}

export interface PatientSessionDto {
  id: string;
  status: string;
  currentStep: PatientFlowStep;
  language: string;
  patient?: PatientDetailsDto;
  visit?: VisitDto;
  draft?: Record<string, string>;
  lastActiveAt: string;
  sessionToken?: string;
}

export const languageCodes = {
  English: "en",
  Hindi: "hi",
} as const;

export type LanguageCode = (typeof languageCodes)[keyof typeof languageCodes];

export type KnownLanguageCode =
  | LanguageCode
  | "ta"
  | "te"
  | "mr"
  | "bn"
  | "gu"
  | "kn"
  | "ml"
  | "pa"
  | "or"
  | "ur";
export type ScriptCode =
  | "LATN"
  | "DEVA"
  | "TAML"
  | "TELU"
  | "BENG"
  | "GUJR"
  | "KNDA"
  | "MLYM"
  | "GURU"
  | "ORYA"
  | "ARAB";
export type LanguageSupportStatus =
  "SUPPORTED" | "PARTIALLY_SUPPORTED" | "COMING_SOON" | "UNSUPPORTED";

export interface LanguageProfile {
  code: KnownLanguageCode;
  name: string;
  nativeName: string;
  script: ScriptCode;
  locale: string;
  direction: "LTR" | "RTL";
  uiSupported: boolean;
  speechSupported: boolean;
  textSupported: boolean;
  translationSupported: boolean;
  ttsSupported: boolean;
  clinicalGlossaryAvailable: boolean;
  status: LanguageSupportStatus;
}

export interface LanguageDetectionDto {
  selectedLanguage?: LanguageCode;
  primaryLanguage: LanguageCode;
  detectedLanguages: LanguageCode[];
  confidence: number;
  uncertain: boolean;
}

export type TranslationContext =
  | "UI"
  | "PATIENT_QUESTION"
  | "PATIENT_CONFIRMATION"
  | "SAFETY_MESSAGE"
  | "DOCTOR_DISPLAY";

export interface TranslationDto {
  sourceText: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  translatedText: string;
  contextType: TranslationContext;
  provider: string;
  fallbackUsed: boolean;
}

export const supportedLanguages: ReadonlyArray<{
  code: LanguageCode;
  label: string;
  nativeLabel: string;
}> = [
  { code: languageCodes.English, label: "English", nativeLabel: "English" },
  { code: languageCodes.Hindi, label: "Hindi", nativeLabel: "हिन्दी" },
];

export type VoiceInteractionStatus =
  | "RECORDING"
  | "PROCESSING"
  | "TRANSCRIBED"
  | "CONFIRMED"
  | "EDITED"
  | "FAILED"
  | "CANCELLED";

export type ConfidenceBand = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export interface VoiceInteractionDto {
  id: string;
  sessionId: string;
  visitId?: string;
  selectedLanguage: LanguageCode;
  detectedLanguage?: LanguageCode;
  detectedLanguages?: LanguageCode[];
  languageNotice?: string;
  originalTranscript?: string;
  normalizedTranscript?: string;
  patientEditedTranscript?: string;
  acceptedTranscript?: string;
  confidenceBand: ConfidenceBand;
  status: VoiceInteractionStatus;
  startedAt: string;
  completedAt?: string;
}

export type InterviewInputType =
  | "TEXT"
  | "LONG_TEXT"
  | "VOICE"
  | "CHOICE"
  | "MULTI_SELECT"
  | "YES_NO"
  | "NUMBER"
  | "DATE"
  | "DURATION"
  | "SLIDER";

export type KnowledgeState =
  "YES" | "NO" | "UNKNOWN" | "NOT_ASKED" | "NOT_APPLICABLE" | "CONFLICT";
export type InterviewStatus = "ACTIVE" | "REVIEW" | "COMPLETED" | "ABANDONED";
export type InterviewResponseStatus =
  "CAPTURED" | "STRUCTURED" | "CONFIRMED" | "NEEDS_CLARIFICATION";

export interface InterviewQuestionDto {
  id: string;
  category: string;
  text: string;
  alternativeText?: string;
  inputType: InterviewInputType;
  options?: string[];
  optionValues?: string[];
  required: boolean;
  priority: number;
  helpText?: string;
  version?: number;
  displayLanguage?: LanguageCode;
}

export interface ClinicalFactDto {
  value?: unknown;
  state: KnowledgeState;
  source:
    | "PATIENT_REPORTED"
    | "AI_STRUCTURED"
    | "DOCUMENT_EXTRACTED"
    | "DOCTOR_VERIFIED"
    | "SYSTEM_GENERATED";
  confidence?: "HIGH" | "MEDIUM" | "LOW";
  rawAnswers: string[];
}

export interface ObservationDto {
  id: string;
  patientId: string;
  visitId?: string;
  conceptKey: string;
  display: string;
  codeSystem?: string;
  code?: string;
  category?: string;
  value?: unknown;
  unit?: string;
  referenceRange?: unknown;
  state: KnowledgeState;
  status: string;
  effectiveAt?: string;
  source: ClinicalFactDto["source"];
}

export interface InterviewStateDto {
  pathway: string;
  facts: Record<string, ClinicalFactDto>;
  unknownFields: string[];
  conflicts: string[];
  /** A new answer awaiting explicit resolution; the confirmed fact is preserved. */
  conflictCandidates?: Record<
    string,
    Pick<
      ClinicalFactDto,
      "value" | "state" | "source" | "confidence"
    > & { rawAnswer: string }
  >;
}

export interface InterviewResponseDto {
  id: string;
  questionId: string;
  rawAnswer: string;
  originalText?: string;
  originalLanguage?: LanguageCode;
  displayLanguage?: LanguageCode;
  displayText?: string;
  normalizedAnswer?: unknown;
  language: LanguageCode;
  source: "PATIENT_REPORTED" | "AI_STRUCTURED";
  confidenceBand: ConfidenceBand;
  status: InterviewResponseStatus;
  createdAt: string;
}

export interface InterviewDto {
  id: string;
  sessionId: string;
  visitId: string;
  pathway: string;
  status: InterviewStatus;
  completeness: number;
  completenessMessage: string;
  currentQuestion?: InterviewQuestionDto;
  state: InterviewStateDto;
  responses: InterviewResponseDto[];
  startedAt: string;
  completedAt?: string;
}

export interface InterviewResponsePreviewDto {
  interview: InterviewDto;
  response: InterviewResponseDto;
  needsConfirmation: true;
  clarificationMessage?: string;
}

export type DatabaseHealth = "up" | "down" | "not_configured";

export interface HealthData {
  status: "ok" | "degraded";
  service: "helios-api";
  api: "up";
  database: DatabaseHealth;
  version: string;
}

export type DoctorQueueStatus =
  | "WAITING"
  | "IN_PROGRESS"
  | "NEEDS_REVIEW"
  | "HIGH_PRIORITY_REVIEW"
  | "VERIFIED"
  | "COMPLETED";

export interface DoctorQueueItemDto {
  patientId: string;
  patientCode: string;
  fullName: string;
  age: number;
  sex: PatientSex;
  phone?: string;
  preferredLanguage: string;
  visitId: string;
  visitDate: string;
  appointmentLabel: string;
  tokenNumber?: string;
  chiefComplaint?: string;
  status: DoctorQueueStatus;
  visitStatus: `${VisitStatus}`;
  priority: "ROUTINE" | "ATTENTION" | "HIGH";
  pendingVerificationCount: number;
  openDocumentCount: number;
  openSafetySignalCount: number;
}

export interface DoctorNotificationDto {
  id: string;
  kind:
    | "INTAKE_READY"
    | "SAFETY_ATTENTION"
    | "DOCUMENT_REVIEW"
    | "VERIFICATION_REQUIRED"
    | "CONFLICT";
  title: string;
  summary: string;
  patientId: string;
  visitId: string;
  createdAt: string;
  priority: "NORMAL" | "HIGH";
}

export interface DoctorDashboardDto {
  doctor: {
    id: string;
    displayName: string;
    role: "DOCTOR" | "ADMIN";
    preferredLanguage: string;
  };
  metrics: {
    patientsToday: number;
    waiting: number;
    pendingVerification: number;
    highPriority: number;
    verifiedOrCompleted: number;
  };
  queue: DoctorQueueItemDto[];
  notifications: DoctorNotificationDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  queueScope: "TODAY" | "RECENT_ACTIVE_DEMO_FALLBACK";
  demoMode: boolean;
}

export interface DoctorNoteDto {
  id: string;
  patientId: string;
  visitId?: string;
  content: string;
  author: { id: string; displayName: string };
  createdAt: string;
  updatedAt: string;
  editable: boolean;
}

export interface DoctorSafetySignalDto {
  id: string;
  category: string;
  severity: "INFO" | "LOW" | "MEDIUM" | "HIGH";
  title: string;
  description: string;
  source: string;
  status: "OPEN" | "ACKNOWLEDGED" | "DISMISSED" | "RESOLVED";
  createdAt: string;
  resolvedAt?: string;
  reviewMessage: "Requires clinical review.";
}

export interface DoctorPatientWorkspaceDto {
  doctor: { id: string; displayName: string; role: "DOCTOR" | "ADMIN" };
  patient: {
    id: string;
    patientCode: string;
    fullName: string;
    age: number;
    sex: PatientSex;
    phone?: string;
    preferredLanguage: string;
  };
  visit: {
    id: string;
    status: `${VisitStatus}`;
    visitType: "PRE_CONSULTATION" | "FOLLOW_UP";
    tokenNumber?: string;
    startedAt: string;
    completedAt?: string;
    chiefComplaint?: string;
  };
  clinicalBrief?: ClinicalBriefDto;
  comparison?: ComparisonDto;
  safetySignals: DoctorSafetySignalDto[];
  documents: MedicalDocumentDto[];
  timeline: TimelineEventDto[];
  verificationHistory: VerificationHistoryDto[];
  notes: DoctorNoteDto[];
  aiInsights: {
    label: "AI-STRUCTURED";
    requiresVerification: true;
    missingInformation: string[];
    contradictions: string[];
    pendingVerificationCount: number;
    structuredFactCount: number;
  };
  capabilities: {
    safetyEngineAvailable: false;
    requestInformationAvailable: false;
  };
}

export type QueueTokenStatus =
  | "WAITING"
  | "CALLED"
  | "IN_CONSULTATION"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW"
  | "SKIPPED";

export interface PatientQueueStatusDto {
  tokenId: string;
  tokenNumber: string;
  status: QueueTokenStatus;
  patientsAhead: number;
  position: number | null;
  estimatedWaitMinutes: number | null;
  estimateLabel: string;
  currentToken?: string;
  queuePaused: boolean;
  updatedAt: string;
  refreshAfterSeconds: number;
}

export interface DoctorQueueEntryDto {
  id: string;
  tokenNumber: string;
  patientId: string;
  patientCode: string;
  patientName: string;
  age: number;
  chiefComplaint?: string;
  status: QueueTokenStatus;
  priority: "NORMAL" | "PRIORITY_REVIEW";
  waitMinutes: number;
  createdAt: string;
  calledAt?: string;
  consultationStartedAt?: string;
  completedAt?: string;
}

export interface DoctorQueueDto {
  queueKey: string;
  queueDate: string;
  paused: boolean;
  currentToken?: string;
  entries: DoctorQueueEntryDto[];
  counts: {
    waiting: number;
    called: number;
    inConsultation: number;
    completed: number;
    priorityReview: number;
  };
  updatedAt: string;
  refreshAfterSeconds: number;
}
export * from "./language.js";
export type { SpecializationDto, RoutingRecommendationDto, RoutingAssessmentDto, RoutingProviderDto, RoutingProviderListDto } from "./routing.js";
