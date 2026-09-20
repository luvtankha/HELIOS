import type {
  ApiResponse,
  ComparisonDto,
} from "@helios/shared";
import { publicConfig } from "@/lib/config";
import { ApiRequestError } from "@/services/patient-flow";

export interface DoctorPatient {
  id: string;
  patientCode: string;
  fullName: string;
  visits: Array<{
    id: string;
    startedAt: string;
    status: string;
    tokenNumber?: string;
  }>;
}

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
    throw new ApiRequestError("We couldn’t reach HELIOS just now.");
  }
}

export const comparisonApi = {
  patients: (token: string) =>
    request<DoctorPatient[]>("/doctor/patients", undefined, token),
  create: (
    patientId: string,
    previousVisitId: string,
    currentVisitId: string,
    token: string,
  ) =>
    request<ComparisonDto>(
      `/patients/${patientId}/comparisons`,
      {
        method: "POST",
        body: JSON.stringify({ previousVisitId, currentVisitId }),
      },
      token,
    ),
  quick: (patientId: string, token: string) =>
    request<ComparisonDto>(
      `/patients/${patientId}/comparisons/quick`,
      { method: "POST" },
      token,
    ),
  detail: (id: string, token: string) =>
    request<ComparisonDto>(`/comparisons/${id}`, undefined, token),
};
