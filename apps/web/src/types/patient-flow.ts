import type { LanguageCode, PatientFlowStep, PatientSex } from "@helios/shared";

export interface PatientFormDetails {
  fullName: string;
  age: string;
  sex: PatientSex | "";
  phone: string;
}

export interface PatientFlowState {
  hydrated: boolean;
  sessionId: string | null;
  sessionToken: string | null;
  patientId: string | null;
  visitId: string | null;
  interviewId: string | null;
  pendingQuestionId: string | null;
  currentStep: PatientFlowStep;
  language: LanguageCode;
  details: PatientFormDetails;
  complaint: string;
  answers: Record<string, string>;
  tokenNumber: string | null;
  submittedAt: string | null;
}
