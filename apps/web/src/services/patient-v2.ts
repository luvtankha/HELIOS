import { publicConfig } from "@/lib/config";

export interface V2PatientSession {
  sessionId: string;
  sessionToken: string | null;
  status: string;
  currentStep: string;
  conversationLanguage: "hi-Hinglish";
  patientId: string | null;
  visitId: string | null;
  startedAt: string;
}

export interface V2VoiceSession {
  voiceSessionId: string;
  patientSessionId: string;
  visitId: string | null;
  state: string;
  media: {
    available: boolean;
    transport: string;
    websocketUrl: string | null;
    credential: string | null;
    expiresAt: string | null;
    detail: string | null;
  };
  conversation: {
    languageMode: "hi-Hinglish";
    doctorAvatarId: string;
    bargeIn: boolean;
  };
  lastAcknowledgedSequence: number;
  createdAt: string;
}

export interface V2VoiceEventEnvelope {
  eventId: string;
  voiceSessionId: string;
  sequence: number;
  type: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export class PatientV2ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "PatientV2ApiError";
  }
}

async function decode<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = "HELIOS patient service is unavailable.";
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // Do not expose arbitrary upstream response bodies.
    }
    throw new PatientV2ApiError(detail, response.status);
  }
  return (await response.json()) as T;
}

function request(url: string, init: RequestInit) {
  const timeout = AbortSignal.timeout(15_000);
  return fetch(url, {
    ...init,
    signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
  });
}

function patientSession(value: V2PatientSession): V2PatientSession {
  if (!value || typeof value.sessionId !== "string" || !value.sessionId ||
      typeof value.currentStep !== "string" || typeof value.status !== "string" ||
      value.conversationLanguage !== "hi-Hinglish" ||
      (value.sessionToken !== null && typeof value.sessionToken !== "string")) {
    throw new PatientV2ApiError("Invalid HELIOS patient session response.");
  }
  return value;
}

function voiceSession(value: V2VoiceSession): V2VoiceSession {
  if (!value || typeof value.voiceSessionId !== "string" || !value.voiceSessionId ||
      typeof value.patientSessionId !== "string" ||
      typeof value.media?.available !== "boolean" ||
      typeof value.conversation?.doctorAvatarId !== "string" ||
      !Number.isSafeInteger(value.lastAcknowledgedSequence) || value.lastAcknowledgedSequence < 0) {
    throw new PatientV2ApiError("Invalid HELIOS voice session response.");
  }
  if (value.media.available) {
    let url: URL;
    try { url = new URL(value.media.websocketUrl ?? ""); }
    catch { throw new PatientV2ApiError("Invalid HELIOS voice connection."); }
    if (value.media.transport !== "WEBSOCKET_PCM16" ||
        !["ws:", "wss:"].includes(url.protocol) ||
        typeof value.media.credential !== "string" || !value.media.credential) {
      throw new PatientV2ApiError("Invalid HELIOS voice connection.");
    }
  }
  return value;
}

export const patientV2Service = {
  async createSession(signal?: AbortSignal): Promise<V2PatientSession> {
    const response = await request(
      `${publicConfig.patientApiV2Url}/api/v2/patient-sessions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationLanguage: "hi-Hinglish" }),
        ...(signal ? { signal } : {}),
      },
    );
    return patientSession(await decode<V2PatientSession>(response));
  },

  async getSession(
    sessionId: string,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<V2PatientSession> {
    const response = await request(
      `${publicConfig.patientApiV2Url}/api/v2/patient-sessions/${encodeURIComponent(sessionId)}`,
      {
        headers: { "x-session-token": sessionToken },
        ...(signal ? { signal } : {}),
      },
    );
    return patientSession(await decode<V2PatientSession>(response));
  },

  async createVoiceSession(
    session: V2PatientSession,
    signal?: AbortSignal,
  ): Promise<V2VoiceSession> {
    if (!session.sessionToken) {
      throw new PatientV2ApiError("Patient session proof is missing.");
    }
    const response = await request(
      `${publicConfig.patientApiV2Url}/api/v2/voice-sessions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-session-token": session.sessionToken,
        },
        body: JSON.stringify({
          patientSessionId: session.sessionId,
          visitId: session.visitId,
          capabilities: {
            bargeIn: true,
            languageMode: "hi-Hinglish",
          },
        }),
        ...(signal ? { signal } : {}),
      },
    );
    return voiceSession(await decode<V2VoiceSession>(response));
  },

  async recordPreConsultationConsent(
    session: V2PatientSession,
    signal?: AbortSignal,
  ): Promise<{ consentId: string; accepted: boolean }> {
    if (!session.sessionToken) {
      throw new PatientV2ApiError("Patient session proof is missing.");
    }
    const response = await request(
      `${publicConfig.patientApiV2Url}/api/v2/consents`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-session-token": session.sessionToken,
        },
        body: JSON.stringify({
          sessionId: session.sessionId,
          consentType: "PRE_CONSULTATION",
          accepted: true,
          version: "1.0",
        }),
        ...(signal ? { signal } : {}),
      },
    );
    return decode<{ consentId: string; accepted: boolean }>(response);
  },

  async resumeVoiceSession(
    voiceSessionId: string,
    sessionToken: string,
    lastAcknowledgedSequence: number,
    signal?: AbortSignal,
  ): Promise<V2VoiceSession> {
    const response = await request(
      `${publicConfig.patientApiV2Url}/api/v2/voice-sessions/${encodeURIComponent(voiceSessionId)}/resume`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-session-token": sessionToken,
        },
        body: JSON.stringify({ lastAcknowledgedSequence }),
        ...(signal ? { signal } : {}),
      },
    );
    return voiceSession(await decode<V2VoiceSession>(response));
  },

  async *streamVoiceEvents(
    voiceSessionId: string,
    sessionToken: string,
    afterSequence: number,
    signal?: AbortSignal,
  ): AsyncGenerator<V2VoiceEventEnvelope> {
    const response = await fetch(
      `${publicConfig.patientApiV2Url}/api/v2/voice-sessions/${encodeURIComponent(voiceSessionId)}/events?after=${afterSequence}`,
      {
        headers: { "x-session-token": sessionToken },
        ...(signal ? { signal } : {}),
      },
    );
    if (!response.ok || !response.body) {
      if (!response.ok) await decode<never>(response);
      throw new PatientV2ApiError(
        "HELIOS realtime event stream is unavailable.",
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = "";
    try {
      while (true) {
        const { value, done } = await reader.read();
        pending += decoder.decode(value, { stream: !done });
        if (pending.length > 1_048_576)
          throw new PatientV2ApiError("HELIOS realtime event exceeds the size limit.");
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        for (const line of lines) {
          const event = parseVoiceEventLine(line);
          if (event) yield event;
        }
        if (done) break;
      }
      const finalEvent = parseVoiceEventLine(pending);
      if (finalEvent) yield finalEvent;
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  },
};

export function parseVoiceEventLine(line: string): V2VoiceEventEnvelope | null {
  if (!line.trim()) return null;
  const value = JSON.parse(line) as Partial<V2VoiceEventEnvelope>;
  if (
    value === null || typeof value !== "object" ||
    typeof value.eventId !== "string" ||
    typeof value.voiceSessionId !== "string" ||
    typeof value.sequence !== "number" ||
    !Number.isSafeInteger(value.sequence) ||
    value.sequence <= 0 ||
    typeof value.type !== "string" ||
    typeof value.occurredAt !== "string" ||
    value.payload === null ||
    typeof value.payload !== "object" ||
    Array.isArray(value.payload)
  ) {
    throw new PatientV2ApiError("Invalid HELIOS realtime event envelope.");
  }
  return value as V2VoiceEventEnvelope;
}
