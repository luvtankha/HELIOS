import type {
  ApiResponse,
  InterviewDto,
  InterviewResponsePreviewDto,
  LanguageCode,
} from "@helios/shared";
import { publicConfig } from "@/lib/config";
import { ApiRequestError } from "./patient-flow";

async function request<T>(
  path: string,
  sessionToken: string,
  init?: RequestInit,
): Promise<T> {
  try {
    const response = await fetch(
      `${publicConfig.apiUrl}/api/v1/interviews${path}`,
      {
        ...init,
        headers: {
          "content-type": "application/json",
          "x-session-token": sessionToken,
          ...init?.headers,
        },
      },
    );
    const payload = (await response.json()) as ApiResponse<T>;
    if (!response.ok || !payload.success) {
      throw new ApiRequestError(
        payload.success
          ? "We couldn't save that answer."
          : payload.error.message,
      );
    }
    return payload.data;
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    throw new ApiRequestError(
      "We couldn't connect just now. Your answer is still on this screen.",
    );
  }
}

export const interviewService = {
  create: (
    input: {
      sessionId: string;
      chiefComplaint: string;
      language: LanguageCode;
    },
    token: string,
  ) =>
    request<InterviewDto>("/", token, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  get: (id: string, token: string) => request<InterviewDto>(`/${id}`, token),
  respond: (
    id: string,
    input: { questionId: string; rawAnswer: string; language: LanguageCode },
    token: string,
  ) =>
    request<InterviewResponsePreviewDto>(`/${id}/response`, token, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  confirm: (id: string, responseId: string, token: string) =>
    request<InterviewDto>(`/${id}/confirm`, token, {
      method: "POST",
      body: JSON.stringify({ responseId }),
    }),
  complete: (id: string, token: string) =>
    request<InterviewDto>(`/${id}/complete`, token, {
      method: "POST",
      body: "{}",
    }),
  revise: (id: string, field: string, token: string) =>
    request<InterviewDto>(`/${id}/revise`, token, {
      method: "POST",
      body: JSON.stringify({ field }),
    }),
};
