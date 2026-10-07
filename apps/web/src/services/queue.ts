import type { ApiResponse, PatientQueueStatusDto } from "@helios/shared";
import { publicConfig } from "@/lib/config";
import { ApiRequestError } from "@/services/patient-flow";

async function request<T>(path: string, token: string, method = "GET") {
  try {
    const response = await fetch(`${publicConfig.apiUrl}/api/v1${path}`, {
      method,
      headers: {
        "x-session-token": token,
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
    request<PatientQueueStatusDto>("/patient/me/queue-status", token),
  checkIn: (token: string) =>
    request<PatientQueueStatusDto>("/patient/check-in", token, "POST"),
};
