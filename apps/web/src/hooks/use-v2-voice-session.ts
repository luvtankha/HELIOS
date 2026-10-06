"use client";

import { useEffect, useState } from "react";
import {
  patientV2Service,
  type V2PatientSession,
  type V2VoiceSession,
} from "@/services/patient-v2";

type VoiceSessionState =
  | { status: "idle" | "connecting"; voiceSession: null; error: null }
  | { status: "ready" | "blocked"; voiceSession: V2VoiceSession; error: null }
  | { status: "error"; voiceSession: null; error: string };

export function useV2VoiceSession(
  patientSession: V2PatientSession | null,
): VoiceSessionState {
  const [state, setState] = useState<VoiceSessionState>({
    status: patientSession ? "connecting" : "idle",
    voiceSession: null,
    error: null,
  });

  useEffect(() => {
    if (
      !patientSession ||
      ["CONSENT", "REVIEW", "COMPLETE"].includes(patientSession.currentStep)
    ) {
      setState({ status: "idle", voiceSession: null, error: null });
      return;
    }
    const controller = new AbortController();
    setState({ status: "connecting", voiceSession: null, error: null });

    void patientV2Service
      .createVoiceSession(patientSession, controller.signal)
      .then((voiceSession) => {
        if (controller.signal.aborted) return;
        setState({
          status: voiceSession.media.available ? "ready" : "blocked",
          voiceSession,
          error: null,
        });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          voiceSession: null,
          error: "आवाज़ से बातचीत शुरू नहीं हो सकी। कृपया फिर प्रयास करें।",
        });
      });

    return () => controller.abort();
  }, [patientSession]);

  return state;
}
