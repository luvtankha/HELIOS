import type {
  ApiResponse,
  TimelineEventDetailDto,
  TimelineEventType,
  TimelinePageDto,
  TimelineSource,
  TimelineVerificationStatus,
} from "@helios/shared";
import { publicConfig } from "@/lib/config";
import { ApiRequestError } from "@/services/patient-flow";

export interface TimelineQuery {
  from?: string;
  to?: string;
  eventType?: TimelineEventType;
  category?: "DOCUMENTS";
  sourceType?: TimelineSource;
  verificationStatus?: TimelineVerificationStatus;
  cursor?: string;
  sort?: "asc" | "desc";
  limit?: number;
}

async function request<T>(path: string, token: string, init?: RequestInit) {
  try {
    const response = await fetch(`${publicConfig.apiUrl}/api/v1${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        "x-session-token": token,
        ...init?.headers,
      },
    });
    const payload = (await response.json()) as ApiResponse<T>;
    if (!response.ok || !payload.success)
      throw new ApiRequestError(
        payload.success
          ? "The timeline request failed."
          : payload.error.message,
      );
    return payload.data;
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    throw new ApiRequestError("We couldn’t reach your timeline just now.");
  }
}

export const timelineApi = {
  list(patientId: string, token: string, query: TimelineQuery = {}) {
    const parameters = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (value !== undefined) parameters.set(key, String(value));
    const suffix = parameters.size ? `?${parameters.toString()}` : "";
    return request<TimelinePageDto>(
      `/patients/${patientId}/timeline${suffix}`,
      token,
    );
  },
  detail: (eventId: string, token: string) =>
    request<TimelineEventDetailDto>(`/timeline/${eventId}`, token),
  rebuild: (patientId: string, token: string) =>
    request<{ projectedEventCount: number }>(
      `/patients/${patientId}/timeline/rebuild`,
      token,
      { method: "POST" },
    ),
};
