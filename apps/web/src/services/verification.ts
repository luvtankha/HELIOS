import type {
  ApiResponse,
  VerificationAction,
  VerificationActionResultDto,
  VerificationQueueDto,
  VerificationReviewDto,
} from "@helios/shared";
import type { MedicalDocumentDto } from "@helios/shared";
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
          ? "Verification request failed."
          : payload.error.message,
      );
    return payload.data;
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    throw new ApiRequestError("We couldn’t reach the verification service.");
  }
}

const actionPaths: Record<Exclude<VerificationAction, "SUPERSEDE">, string> = {
  VERIFY: "verify",
  CORRECT: "correct",
  REJECT: "reject",
  MARK_UNCERTAIN: "uncertain",
  CONFIRM_CURRENT: "confirm-current",
  KEEP_PREVIOUS: "keep-previous",
};

export const verificationApi = {
  queue: (token: string, query = "") =>
    request<VerificationQueueDto>(
      `/verification-queue${query ? `?${query}` : ""}`,
      token,
    ),
  detail: (reviewId: string, token: string) =>
    request<VerificationReviewDto>(
      `/verification/${encodeURIComponent(reviewId)}`,
      token,
    ),
  action: (
    reviewId: string,
    action: Exclude<VerificationAction, "SUPERSEDE">,
    body: {
      expectedVersion: number;
      idempotencyKey: string;
      reason?: string;
      comment?: string;
      correctedValue?: Record<string, unknown>;
    },
    token: string,
  ) =>
    request<VerificationActionResultDto>(
      `/verification/${encodeURIComponent(reviewId)}/${actionPaths[action]}`,
      token,
      { method: "POST", body: JSON.stringify(body) },
    ),
  document: (documentId: string, token: string) =>
    request<MedicalDocumentDto>(
      `/verification/documents/${encodeURIComponent(documentId)}`,
      token,
    ),
  async documentContent(documentId: string, token: string) {
    const response = await fetch(
      `${publicConfig.apiUrl}/api/v1/verification/documents/${encodeURIComponent(documentId)}/content`,
      { headers: { "x-doctor-token": token } },
    );
    if (!response.ok)
      throw new ApiRequestError("We couldn’t open this document.");
    return URL.createObjectURL(await response.blob());
  },
};
