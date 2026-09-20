import type {
  ApiResponse,
  DoctorQueueDto,
  DoctorQueueEntryDto,
  PatientQueueStatusDto,
} from "@helios/shared";
import { publicConfig } from "@/lib/config";
import { ApiRequestError } from "@/services/patient-flow";

async function request<T>(
  path: string,
  token: string,
  role: "patient" | "doctor",
  method = "GET",
) {
  try {
    const response = await fetch(`${publicConfig.apiUrl}/api/v1${path}`, {
      method,
      headers: {
        [role === "patient" ? "x-session-token" : "x-doctor-token"]: token,
        "content-type": "application/json",
      },
      cache: "no-store",
    });
    const payload = (await response.json()) as ApiResponse<T>;
    if (!response.ok || !payload.success)
      throw new ApiRequestError(
        payload.success ? "Queue request failed." : payload.error.message,
      );
    return payload.data;
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    throw new ApiRequestError(
      "Queue updates are temporarily unavailable. Your token has not changed.",
    );
  }
}

export const patientQueueApi = {
  status: (token: string) =>
    request<PatientQueueStatusDto>(
      "/patient/me/queue-status",
      token,
      "patient",
    ),
  checkIn: (token: string) =>
    request<PatientQueueStatusDto>(
      "/patient/check-in",
      token,
      "patient",
      "POST",
    ),
};
export const doctorQueueApi = {
  list: (token: string) =>
    request<DoctorQueueDto>("/doctor/queue", token, "doctor"),
  callNext: (token: string) =>
    request<DoctorQueueEntryDto>(
      "/doctor/queue/call-next",
      token,
      "doctor",
      "POST",
    ),
  act: (tokenId: string, action: string, token: string) =>
    request<DoctorQueueEntryDto>(
      `/doctor/tokens/${encodeURIComponent(tokenId)}/${encodeURIComponent(action)}`,
      token,
      "doctor",
      "POST",
    ),
  pause: (token: string) =>
    request<{ paused: boolean }>(
      "/doctor/queue/pause",
      token,
      "doctor",
      "POST",
    ),
  resume: (token: string) =>
    request<{ paused: boolean }>(
      "/doctor/queue/resume",
      token,
      "doctor",
      "POST",
    ),
};
