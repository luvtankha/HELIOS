"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  PatientV2ApiError,
  patientV2Service,
  type V2PatientSession,
} from "@/services/patient-v2";

const STORAGE_KEY = "helios:v2:patient-session";

type SessionState =
  | { status: "connecting"; session: null; error: null }
  | { status: "ready"; session: V2PatientSession; error: null }
  | { status: "error"; session: null; error: string };

type ConsentStatus = "idle" | "saving" | "error";

export function useV2PatientSession() {
  const [state, setState] = useState<SessionState>({
    status: "connecting",
    session: null,
    error: null,
  });
  const [consentStatus, setConsentStatus] = useState<ConsentStatus>("idle");
  const [consentError, setConsentError] = useState<string | null>(null);
  const consentInFlight = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    async function connect() {
      try {
        const stored = readStoredSession();
        if (stored) {
          try {
            const resumed = await patientV2Service.getSession(
              stored.sessionId,
              stored.sessionToken,
              controller.signal,
            );
            if (!controller.signal.aborted) {
              setState({
                status: "ready",
                session: { ...resumed, sessionToken: stored.sessionToken },
                error: null,
              });
            }
            return;
          } catch (error) {
            if (controller.signal.aborted) return;
            if (
              !(error instanceof PatientV2ApiError) ||
              ![401, 403, 404].includes(error.status ?? 0)
            ) {
              throw error;
            }
            clearStoredPatientSession();
          }
        }

        const created = await patientV2Service.createSession(controller.signal);
        if (!created.sessionToken)
          throw new Error("patient session proof missing");
        if (controller.signal.aborted) return;
        try {
          sessionStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              sessionId: created.sessionId,
              sessionToken: created.sessionToken,
            }),
          );
        } catch {
          // A restricted browser can still use this in-memory consultation.
        }
        if (!controller.signal.aborted) {
          setState({ status: "ready", session: created, error: null });
        }
      } catch {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          session: null,
          error:
            "बातचीत शुरू नहीं हो सकी। कृपया अपना इंटरनेट कनेक्शन जाँचकर फिर प्रयास करें।",
        });
      }
    }

    void connect();
    return () => controller.abort();
  }, []);

  const acceptConsent = useCallback(async () => {
    if (state.status !== "ready" || state.session.currentStep !== "CONSENT")
      return;
    if (consentInFlight.current) return;
    if (!state.session.sessionToken) {
      setConsentStatus("error");
      setConsentError("सत्र की पुष्टि नहीं हो सकी। कृपया पेज दोबारा खोलें।");
      return;
    }

    consentInFlight.current = true;
    setConsentStatus("saving");
    setConsentError(null);
    try {
      await patientV2Service.recordPreConsultationConsent(state.session);
      const refreshed = await patientV2Service.getSession(
        state.session.sessionId,
        state.session.sessionToken,
      );
      setState({
        status: "ready",
        session: {
          ...refreshed,
          sessionToken: state.session.sessionToken,
        },
        error: null,
      });
      setConsentStatus("idle");
    } catch {
      setConsentStatus("error");
      setConsentError(
        "आपकी सहमति सुरक्षित नहीं हो सकी। कृपया फिर प्रयास करें।",
      );
    } finally {
      consentInFlight.current = false;
    }
  }, [state]);

  return {
    ...state,
    consentStatus,
    consentError,
    acceptConsent,
  } as const;
}

function readStoredSession(): {
  sessionId: string;
  sessionToken: string;
} | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<{
      sessionId: string;
      sessionToken: string;
    }>;
    if (typeof value?.sessionId !== "string" || !value.sessionId ||
        typeof value.sessionToken !== "string" || !value.sessionToken) return null;
    return { sessionId: value.sessionId, sessionToken: value.sessionToken };
  } catch {
    return null;
  }
}

export function clearStoredPatientSession() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // No persistent session is available when browser storage is disabled.
  }
}
