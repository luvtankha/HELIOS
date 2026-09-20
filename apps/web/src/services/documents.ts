import type {
  ApiResponse,
  DocumentProcessingStatusDto,
  MedicalDocumentDto,
} from "@helios/shared";
import { publicConfig } from "@/lib/config";
import { ApiRequestError } from "@/services/patient-flow";

async function request<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  try {
    const response = await fetch(`${publicConfig.apiUrl}/api/v1${path}`, {
      ...init,
      headers: {
        "x-session-token": token,
        ...(!(init?.body instanceof FormData) && {
          "content-type": "application/json",
        }),
        ...init?.headers,
      },
    });
    if (response.status === 204) return undefined as T;
    const payload = (await response.json()) as ApiResponse<T>;
    if (!response.ok || !payload.success)
      throw new ApiRequestError(
        payload.success ? "The document action failed." : payload.error.message,
      );
    return payload.data;
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    throw new ApiRequestError(
      "We couldn’t reach the document service just now.",
    );
  }
}

export const documentApi = {
  upload(input: {
    file: File;
    sessionId: string;
    patientId: string;
    visitId?: string;
    token: string;
  }) {
    const body = new FormData();
    body.append("document", input.file);
    body.append("sessionId", input.sessionId);
    body.append("patientId", input.patientId);
    if (input.visitId) body.append("visitId", input.visitId);
    return request<MedicalDocumentDto>("/documents", input.token, {
      method: "POST",
      body,
    });
  },
  get: (id: string, token: string) =>
    request<MedicalDocumentDto>(`/documents/${id}`, token),
  status: (id: string, token: string) =>
    request<DocumentProcessingStatusDto>(`/documents/${id}/status`, token),
  list: (patientId: string, token: string) =>
    request<MedicalDocumentDto[]>(`/patients/${patientId}/documents`, token),
  process: (id: string, token: string) =>
    request<MedicalDocumentDto>(`/documents/${id}/process`, token, {
      method: "POST",
    }),
  factAction: (
    documentId: string,
    factId: string,
    action: "confirm" | "edit" | "reject",
    token: string,
    value?: unknown,
  ) =>
    request<MedicalDocumentDto>(
      `/documents/${documentId}/facts/${factId}/${action}`,
      token,
      {
        method: "POST",
        ...(action === "edit" && { body: JSON.stringify({ value }) }),
      },
    ),
  overrideIdentity: (id: string, token: string) =>
    request<MedicalDocumentDto>(`/documents/${id}/identity/override`, token, {
      method: "POST",
    }),
  remove: (id: string, token: string) =>
    request<void>(`/documents/${id}`, token, { method: "DELETE" }),
  async content(id: string, token: string) {
    const response = await fetch(
      `${publicConfig.apiUrl}/api/v1/documents/${id}/content`,
      {
        headers: { "x-session-token": token },
      },
    );
    if (!response.ok)
      throw new ApiRequestError("We couldn’t open this document.");
    return URL.createObjectURL(await response.blob());
  },
};
