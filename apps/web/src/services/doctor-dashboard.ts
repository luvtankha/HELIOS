import type {
  ApiResponse,
  DoctorDashboardDto,
  DoctorNoteDto,
  DoctorPatientWorkspaceDto,
  DoctorSessionDto,
} from "@helios/shared";
import { publicConfig } from "@/lib/config";
import { ApiRequestError } from "@/services/patient-flow";

async function request<T>(path: string, init?: RequestInit, token?: string) {
  try {
    const response = await fetch(`${publicConfig.apiUrl}/api/v1${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(token && { "x-doctor-token": token }),
        ...init?.headers,
      },
    });
    const payload = (await response.json()) as ApiResponse<T>;
    if (!response.ok || !payload.success)
      throw new ApiRequestError(
        payload.success ? "Request failed." : payload.error.message,
      );
    return payload.data;
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    throw new ApiRequestError("We couldn’t reach the HELIOS clinical service.");
  }
}

export const doctorDashboardApi = {
  resetDemo: (token: string) =>
    request<{
      environment: "sih-demo";
      scenario: "golden-patient";
      resetId: string;
      state: "READY";
      durationMs: number;
    }>(
      "/demo/reset",
      {
        method: "POST",
        body: JSON.stringify({ confirmation: "RESET SIH DEMO" }),
      },
      token,
    ),
  signIn: (username: string, accessCode: string) =>
    request<DoctorSessionDto>("/doctor-sessions", {
      method: "POST",
      body: JSON.stringify({ username, accessCode }),
    }),
  dashboard: (query: URLSearchParams, token: string) =>
    request<DoctorDashboardDto>(
      `/doctor/dashboard?${query.toString()}`,
      undefined,
      token,
    ),
  workspace: (patientId: string, token: string, visitId?: string) =>
    request<DoctorPatientWorkspaceDto>(
      `/doctor/patients/${encodeURIComponent(patientId)}/workspace${visitId ? `?visitId=${encodeURIComponent(visitId)}` : ""}`,
      undefined,
      token,
    ),
  createNote: (
    patientId: string,
    content: string,
    visitId: string | undefined,
    token: string,
  ) =>
    request<DoctorNoteDto>(
      `/doctor/patients/${encodeURIComponent(patientId)}/notes`,
      {
        method: "POST",
        body: JSON.stringify({ content, ...(visitId && { visitId }) }),
      },
      token,
    ),
  updateNote: (
    patientId: string,
    noteId: string,
    content: string,
    token: string,
  ) =>
    request<DoctorNoteDto>(
      `/doctor/patients/${encodeURIComponent(patientId)}/notes/${encodeURIComponent(noteId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ content }),
      },
      token,
    ),
  transitionVisit: (
    visitId: string,
    status: "IN_PROGRESS" | "UNDER_REVIEW" | "VERIFIED" | "COMPLETED",
    token: string,
  ) =>
    request<{ visitId: string; status: string }>(
      `/doctor/visits/${encodeURIComponent(visitId)}/status`,
      {
        method: "POST",
        body: JSON.stringify({ status }),
      },
      token,
    ),
};
