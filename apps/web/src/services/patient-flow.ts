import type {
  ApiResponse,
  LanguageCode,
  PatientDetailsDto,
  PatientFlowStep,
  PatientSessionDto,
  PatientSex,
} from "@helios/shared";
import { publicConfig } from "@/lib/config";

export class ApiRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${publicConfig.apiUrl}/api/v1${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    });
    const payload = (await response.json()) as ApiResponse<T>;
    if (!response.ok || !payload.success) {
      throw new ApiRequestError(
        payload.success
          ? "We couldn’t save that just now."
          : payload.error.message,
      );
    }
    return payload.data;
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    throw new ApiRequestError(
      "We couldn’t connect just now. Your answers are still here.",
    );
  }
}

export const patientApi = {
  createSession: (language: LanguageCode) =>
    request<PatientSessionDto>("/patient-sessions", {
      method: "POST",
      body: JSON.stringify({ language }),
    }),
  getSession: (id: string, token: string) =>
    request<PatientSessionDto>(`/patient-sessions/${id}`, {
      headers: { "x-session-token": token },
    }),
  updateProgress: (
    id: string,
    input: {
      currentStep: PatientFlowStep;
      language?: string;
      draftData?: Record<string, string>;
    },
    token: string,
  ) =>
    request<PatientSessionDto>(`/patient-sessions/${id}/progress`, {
      method: "PATCH",
      headers: { "x-session-token": token },
      body: JSON.stringify(input),
    }),
  saveConsent: (sessionId: string, token: string) =>
    request<{ id: string }>("/consents", {
      method: "POST",
      headers: { "x-session-token": token },
      body: JSON.stringify({
        sessionId,
        consentType: "PRE_CONSULTATION",
        accepted: true,
        version: "1.0",
      }),
    }),
  savePatient: (
    input: {
      sessionId: string;
      fullName: string;
      age: number;
      sex: PatientSex;
      preferredLanguage: string;
      phone?: string;
    },
    token: string,
  ) =>
    request<{ patient: PatientDetailsDto; visitId: string }>("/patients", {
      method: "POST",
      headers: { "x-session-token": token },
      body: JSON.stringify(input),
    }),
  submit: (sessionId: string, sessionToken: string) =>
    request<PatientSessionDto>(`/patient-sessions/${sessionId}/submit`, {
      method: "POST",
      headers: { "x-session-token": sessionToken },
    }),
};
