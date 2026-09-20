import type {
  ApiResponse,
  LanguageCode,
  LanguageDetectionDto,
  LanguageProfile,
  TranslationDto,
} from "@helios/shared";
import { publicConfig } from "@/lib/config";

async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${publicConfig.apiUrl}/api/v1${path}`, init);
  if (response.status === 204) return undefined as T;
  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !payload.success)
    throw new Error(
      payload.success ? "Language request failed" : payload.error.message,
    );
  return payload.data;
}

export const languageApi = {
  list: () => request<LanguageProfile[]>("/languages"),
  detect: (text: string, selectedLanguage: LanguageCode, token: string) =>
    request<LanguageDetectionDto>("/language/detect", {
      method: "POST",
      headers: { "content-type": "application/json", "x-session-token": token },
      body: JSON.stringify({ text, selectedLanguage }),
    }),
  translate: (
    input: {
      text: string;
      sourceLanguage: LanguageCode;
      targetLanguage: LanguageCode;
      contextType: "DOCTOR_DISPLAY";
    },
    doctorToken: string,
  ) =>
    request<TranslationDto>("/translate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-doctor-token": doctorToken,
      },
      body: JSON.stringify(input),
    }),
  setDoctorLanguage: (language: LanguageCode, doctorToken: string) =>
    request<void>("/doctor/language", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-doctor-token": doctorToken,
      },
      body: JSON.stringify({ language }),
    }),
};
