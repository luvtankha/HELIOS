import type {
  ApiResponse,
  BriefClaimDto,
  ClinicalBriefDto,
} from "@helios/shared";
import { publicConfig } from "@/lib/config";
import { ApiRequestError } from "@/services/patient-flow";

async function request<T>(path: string, token: string, init?: RequestInit) {
  try {
    const response = await fetch(`${publicConfig.apiUrl}/api/v1${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        "x-doctor-token": token,
        ...init?.headers,
      },
    });
    const payload = (await response.json()) as ApiResponse<T>;
    if (!response.ok || !payload.success)
      throw new ApiRequestError(
        payload.success
          ? "Clinical brief request failed."
          : payload.error.message,
      );
    return payload.data;
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    throw new ApiRequestError("We couldn’t reach the clinical brief service.");
  }
}

export const clinicalBriefApi = {
  quick: (patientId: string, token: string, visitId?: string) =>
    request<ClinicalBriefDto>(
      `/patients/${patientId}/clinical-brief${visitId ? `?visitId=${encodeURIComponent(visitId)}` : ""}`,
      token,
    ),
  refresh: (briefId: string, token: string) =>
    request<ClinicalBriefDto>(`/briefs/${briefId}/refresh`, token, {
      method: "POST",
    }),
  review: (briefId: string, token: string) =>
    request<ClinicalBriefDto>(`/briefs/${briefId}/review`, token, {
      method: "POST",
    }),
  claim: (briefId: string, claimId: string, token: string) =>
    request<BriefClaimDto>(`/briefs/${briefId}/claims/${claimId}`, token),
};
