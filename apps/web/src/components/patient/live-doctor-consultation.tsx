"use client";

import { useReducer } from "react";
import { ConsultationBrand, ConsultationScene } from "./consultation-scene";
import styles from "./live-consultation.module.css";
import { useLiveMicrophone } from "@/hooks/use-live-microphone";
import {
  clearStoredPatientSession,
  useV2PatientSession,
} from "@/hooks/use-v2-patient-session";
import { useV2RealtimeEvents } from "@/hooks/use-v2-realtime-events";
import { primeLiveAudio, useV2VoiceMedia } from "@/hooks/use-v2-voice-media";
import { useV2VoiceSession } from "@/hooks/use-v2-voice-session";
import {
  initialConsultationState,
  reduceConsultation,
  type ConsultationEvent,
} from "@/lib/live-consultation-state";

export function LiveDoctorConsultation() {
  const [state, dispatch] = useReducer(
    reduceConsultation,
    initialConsultationState,
  );
  const patientSession = useV2PatientSession();
  const voiceSession = useV2VoiceSession(patientSession.session);
  const complete =
    state.phase === "complete" ||
    ["REVIEW", "COMPLETE"].includes(patientSession.session?.currentStep ?? "");
  const microphone = useLiveMicrophone(
    voiceSession.status === "ready" && !complete && state.phase !== "error",
  );
  const voiceMedia = useV2VoiceMedia(
    voiceSession.voiceSession,
    patientSession.session?.sessionToken ?? null,
    microphone.state,
    microphone.streamRef,
    dispatch,
  );
  const awaitingConsent =
    patientSession.status === "ready" &&
    patientSession.session.currentStep === "CONSENT";
  useV2RealtimeEvents(
    voiceSession.voiceSession,
    patientSession.session?.sessionToken ?? null,
    dispatch,
  );

  const connectionFailed =
    patientSession.status === "error" ||
    voiceSession.status === "error" ||
    voiceSession.status === "blocked" ||
    voiceMedia.status === "error" ||
    state.phase === "error";

  return (
    <main lang="hi" className={styles.page}>
      <div className={styles.stage}>
        <h1 className="sr-only">HELIOS से बातचीत</h1>
        <ConsultationScene
          phase={state.phase}
          doctorAvatarId={state.activeDoctorId}
          awaitingConsent={awaitingConsent}
          complete={complete}
        />
        <header className={styles.header}>
          <ConsultationBrand />
        </header>
        {(awaitingConsent ||
          (state.phase === "doctor-speaking" &&
            state.speechBubble !== null)) && (
          <div role="status" aria-live="polite" className={styles.bubble}>
            <span className={styles.bubbleText}>
              {awaitingConsent
                ? "नमस्ते! मैं आपका HELIOS सहायक हूँ। बताइए, आपको क्या तकलीफ़ है?"
                : state.speechBubble}
            </span>
            <svg
              viewBox="0 0 36 34"
              className={styles.bubbleTail}
              aria-hidden="true"
            >
              <path
                d="M2 0C7 13 4 26 1 32C18 25 28 12 35 0"
                fill="white"
                stroke="#648cff"
                strokeWidth="1.5"
              />
            </svg>
          </div>
        )}

        <div className={styles.controls}>
          {patientSession.status === "error" && <p>{patientSession.error}</p>}
          {awaitingConsent && (
            <div className={styles.panel}>
              <p className="text-sm leading-6">
                बातचीत के लिए आपकी आवाज़ Google Gemini सेवा को भेजी जाएगी और
                आपकी बताई जानकारी डॉक्टर के लिए सुरक्षित की जाएगी। क्या आप सहमत
                हैं?
              </p>
              <button
                type="button"
                onClick={() => {
                  primeLiveAudio();
                  void patientSession.acceptConsent();
                }}
                disabled={patientSession.consentStatus === "saving"}
                className={styles.button}
              >
                {patientSession.consentStatus === "saving"
                  ? "आपकी सहमति सुरक्षित हो रही है…"
                  : "हाँ, मैं सहमत हूँ"}
              </button>
              {patientSession.consentError && (
                <p role="alert" className={styles.error}>
                  {patientSession.consentError}
                </p>
              )}
            </div>
          )}
          {voiceSession.status === "blocked" && (
            <p>
              अभी आवाज़ से बातचीत उपलब्ध नहीं है। कृपया क्लिनिक के कर्मचारी से
              संपर्क करें।
            </p>
          )}
          {voiceSession.status === "error" && <p>{voiceSession.error}</p>}
          {voiceMedia.status === "error" && <p>{voiceMedia.error}</p>}
          {state.warning && <p>{state.warning}</p>}
          {voiceSession.status === "ready" &&
            microphone.state === "requesting" && (
              <span className="sr-only">माइक्रोफ़ोन की अनुमति दें</span>
            )}
          {voiceSession.status === "ready" && microphone.state === "denied" && (
            <div role="alert" className={styles.panel}>
              <p>
                बातचीत के लिए ब्राउज़र में माइक्रोफ़ोन की अनुमति दें। फिर दोबारा
                प्रयास करें।
              </p>
              <button
                type="button"
                onClick={() => {
                  primeLiveAudio();
                  microphone.retry();
                }}
                className={styles.button}
              >
                माइक्रोफ़ोन फिर शुरू करें
              </button>
            </div>
          )}
          {voiceSession.status === "ready" &&
            microphone.state === "unavailable" && (
              <p>इस ब्राउज़र में आवाज़ से बातचीत उपलब्ध नहीं है।</p>
            )}
          {microphone.state === "ready" && state.phase === "listening" && (
            <span className="sr-only">HELIOS आपकी बात सुन रहा है</span>
          )}
          {!complete && connectionFailed && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className={styles.button}
            >
              बातचीत फिर जोड़ें
            </button>
          )}
          {!complete &&
            !awaitingConsent &&
            !connectionFailed &&
            (patientSession.status === "connecting" ||
              voiceSession.status === "connecting" ||
              voiceMedia.status === "connecting") && (
              <p role="status" className={styles.message}>
                बातचीत का संपर्क जुड़ रहा है…
              </p>
            )}
          {complete && (
            <div role="status" className={styles.panel}>
              <strong className="block text-lg">
                आपकी जानकारी सुरक्षित हो गई है
              </strong>
              <p className="mt-2">
                डॉक्टर की समीक्षा के लिए आपकी जानकारी तैयार है। क्लिनिक के
                निर्देशों का पालन करें।
              </p>
              <button
                type="button"
                onClick={() => {
                  clearStoredPatientSession();
                  window.location.reload();
                }}
                className={styles.button}
              >
                नई बातचीत शुरू करें
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export function applyConsultationEvent(
  dispatch: (event: ConsultationEvent) => void,
  event: ConsultationEvent,
) {
  dispatch(event);
}
