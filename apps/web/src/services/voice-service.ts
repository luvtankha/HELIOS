import type {
  ApiResponse,
  LanguageCode,
  VoiceInteractionDto,
} from "@helios/shared";
import { publicConfig } from "@/lib/config";
import { ApiRequestError } from "./patient-flow";

interface TranscribeInput {
  audio: Blob;
  sessionId: string;
  sessionToken: string;
  language: LanguageCode;
  durationSeconds: number;
  signal?: AbortSignal;
  onProgress?(percent: number): void;
}

async function voiceRequest(
  path: string,
  sessionToken: string,
  init?: RequestInit,
): Promise<VoiceInteractionDto> {
  try {
    const response = await fetch(`${publicConfig.apiUrl}/api/v1/voice${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
        ...init?.headers,
      },
    });
    const payload = (await response.json()) as ApiResponse<VoiceInteractionDto>;
    if (!response.ok || !payload.success) {
      throw new ApiRequestError(
        payload.success
          ? "We couldn't process your recording."
          : payload.error.message,
      );
    }
    return payload.data;
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    throw new ApiRequestError("We couldn't process your recording.");
  }
}

function transcribe(input: TranscribeInput): Promise<VoiceInteractionDto> {
  if (input.audio.size > publicConfig.voiceMaxFileBytes) {
    return Promise.reject(
      new ApiRequestError(
        "The recording is too large. Please try a shorter response.",
      ),
    );
  }
  return new Promise((resolve, reject) => {
    const form = new FormData();
    const extension = input.audio.type.includes("ogg")
      ? "ogg"
      : input.audio.type.includes("mp4")
        ? "m4a"
        : "webm";
    form.append("audio", input.audio, `recording.${extension}`);
    form.append("sessionId", input.sessionId);
    form.append("language", input.language);
    form.append("durationSeconds", String(input.durationSeconds));

    const request = new XMLHttpRequest();
    request.open("POST", `${publicConfig.apiUrl}/api/v1/voice/transcribe`);
    request.setRequestHeader("x-session-token", input.sessionToken);
    request.timeout = 150_000;
    const abort = () => request.abort();
    if (input.signal?.aborted) {
      reject(new ApiRequestError("Recording cancelled."));
      return;
    }
    input.signal?.addEventListener("abort", abort, { once: true });
    request.addEventListener("loadend", () =>
      input.signal?.removeEventListener("abort", abort),
    );
    request.addEventListener("abort", () =>
      reject(new ApiRequestError("Recording cancelled.")),
    );
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        input.onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    });
    request.addEventListener("load", () => {
      try {
        const payload = JSON.parse(
          request.responseText,
        ) as ApiResponse<VoiceInteractionDto>;
        if (request.status < 200 || request.status >= 300 || !payload.success) {
          reject(
            new ApiRequestError(
              payload.success
                ? "We couldn't process your recording."
                : payload.error.message,
            ),
          );
          return;
        }
        resolve(payload.data);
      } catch {
        reject(new ApiRequestError("We couldn't process your recording."));
      }
    });
    request.addEventListener("error", () =>
      reject(new ApiRequestError("We couldn't process your recording.")),
    );
    request.addEventListener("timeout", () =>
      reject(
        new ApiRequestError(
          "The speech service took too long. Please try again.",
        ),
      ),
    );
    request.send(form);
  });
}

export const voiceService = {
  recordAndTranscribe: transcribe,
  get: (id: string, sessionToken: string) =>
    voiceRequest(`/${id}`, sessionToken),
  edit: (id: string, transcript: string, sessionToken: string) =>
    voiceRequest(`/${id}/edit`, sessionToken, {
      method: "POST",
      body: JSON.stringify({ transcript }),
    }),
  confirm: (id: string, sessionToken: string) =>
    voiceRequest(`/${id}/confirm`, sessionToken, {
      method: "POST",
      body: "{}",
    }),
};
