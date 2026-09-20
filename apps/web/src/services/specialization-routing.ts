import type {
  ApiResponse,
  RoutingAssessmentDto,
  RoutingProviderListDto,
} from "@helios/shared";
import { publicConfig } from "@/lib/config";
import { ApiRequestError } from "./patient-flow";

async function routingRequest<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  try {
    const response = await fetch(`${publicConfig.apiUrl}/api/v1${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        "x-session-token": token,
        ...init?.headers,
      },
    });
    const body = (await response.json()) as ApiResponse<T>;
    if (!response.ok || !body.success)
      throw new ApiRequestError(
        body.success ? "Department routing could not be loaded." : body.error.message,
      );
    return body.data;
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    throw new ApiRequestError("Department routing could not be loaded. Please try again.");
  }
}

export const specializationRoutingApi = {
  assess: (token: string) =>
    routingRequest<RoutingAssessmentDto>("/patient/me/routing", token, {
      method: "POST",
      body: "{}",
    }),
  providers: (token: string, specialization?: string) =>
    routingRequest<RoutingProviderListDto>(
      `/patient/me/providers${specialization ? `?specialization=${encodeURIComponent(specialization)}` : ""}`,
      token,
    ),
  select: (token: string, providerId: string | null) =>
    routingRequest<{ selectedProviderId: string | null }>(
      "/patient/me/routing/provider",
      token,
      { method: "POST", body: JSON.stringify({ providerId }) },
    ),
};
