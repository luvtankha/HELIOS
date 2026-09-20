"use client";

import type { LanguageCode } from "@helios/shared";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { PrimaryCTA, SecondaryCTA } from "@/components/patient/controls";
import { PatientShell } from "@/components/patient/patient-shell";
import { VoiceButton, VoiceWaveform } from "@/components/patient/voice";
import { useSessionGuard } from "@/hooks/use-session-guard";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { interviewService } from "@/services/interview-service";
import { voiceService } from "@/services/voice-service";
import { ApiRequestError } from "@/services/patient-flow";

export default function ListeningPage() {
  const router = useRouter();
  const flow = useSessionGuard();
  const [busy, setBusy] = useState(false);
  const [editingText, setEditingText] = useState("");
  const [textFallback, setTextFallback] = useState(false);
  const [actionError, setActionError] = useState("");
  const isQuestionAnswer = Boolean(
    flow.state.pendingQuestionId && flow.state.interviewId,
  );

  const handleRecording = useCallback(
    async (
      result: { blob: Blob; durationSeconds: number; signal: AbortSignal },
      dispatch: ReturnType<typeof useVoiceRecorder>["dispatch"],
    ) => {
      const { sessionId, sessionToken, language } = flow.state;
      if (!sessionId || !sessionToken) {
        dispatch({
          type: "FAIL",
          code: "SESSION_NOT_READY",
          message: "Please restart your patient session before using voice.",
        });
        return;
      }
      try {
        const interaction = await voiceService.recordAndTranscribe({
          audio: result.blob,
          sessionId,
          sessionToken,
          language: language as LanguageCode,
          durationSeconds: result.durationSeconds,
          signal: result.signal,
          onProgress: (progress) => {
            dispatch({ type: "UPLOAD_PROGRESS", progress });
            if (progress === 100) dispatch({ type: "TRANSCRIBE" });
          },
        });
        dispatch({ type: "TRANSCRIPTION_COMPLETE", interaction });
        dispatch({ type: "AWAIT_CONFIRMATION" });
        if (!result.signal.aborted)
          setEditingText(interaction.originalTranscript ?? "");
      } catch (reason) {
        dispatch({
          type: "FAIL",
          code: "TRANSCRIPTION_FAILED",
          message: message(reason),
        });
      }
    },
    [flow.state],
  );

  const recorder = useVoiceRecorder(handleRecording);
  const interaction = recorder.state.interaction;

  async function saveEdit() {
    if (
      !interaction ||
      !flow.state.sessionToken ||
      editingText.trim().length < 2
    )
      return;
    setBusy(true);
    setActionError("");
    try {
      const updated = await voiceService.edit(
        interaction.id,
        editingText.trim(),
        flow.state.sessionToken,
      );
      recorder.dispatch({ type: "EDIT_SAVED", interaction: updated });
    } catch (reason) {
      setActionError(message(reason));
    } finally {
      setBusy(false);
    }
  }

  async function confirmTranscript() {
    if (!interaction || !flow.state.sessionToken) return;
    setBusy(true);
    setActionError("");
    try {
      const confirmed = await voiceService.confirm(
        interaction.id,
        flow.state.sessionToken,
      );
      const transcript = confirmed.acceptedTranscript ?? editingText;
      if (
        isQuestionAnswer &&
        flow.state.interviewId &&
        flow.state.pendingQuestionId
      ) {
        const preview = await interviewService.respond(
          flow.state.interviewId,
          {
            questionId: flow.state.pendingQuestionId,
            rawAnswer: transcript,
            language: flow.state.language,
          },
          flow.state.sessionToken,
        );
        await interviewService.confirm(
          flow.state.interviewId,
          preview.response.id,
          flow.state.sessionToken,
        );
        flow.setPendingQuestionId(null);
      } else {
        flow.setComplaint(transcript);
      }
      recorder.dispatch({ type: "CONFIRMED", interaction: confirmed });
      router.push("/patient/interview");
    } catch (reason) {
      setActionError(message(reason));
    } finally {
      setBusy(false);
    }
  }

  function continueWithText() {
    const transcript = editingText.trim();
    if (isQuestionAnswer) {
      sessionStorage.setItem("helios.interview.voice-text", transcript);
    } else {
      flow.setComplaint(transcript);
    }
    router.push("/patient/interview");
  }

  if (textFallback) {
    return (
      <PatientShell
        activeStep={isQuestionAnswer ? 2 : 1}
        backHref={
          isQuestionAnswer ? "/patient/interview" : "/patient/complaint"
        }
        eyebrow="Text is always available"
      >
        <section className="mx-auto max-w-2xl">
          <h1 className="text-center font-serif text-4xl">Type your answer</h1>
          <textarea
            aria-label="Your answer"
            maxLength={4000}
            autoFocus
            value={editingText}
            onChange={(event) => setEditingText(event.target.value)}
            className="mt-8 min-h-44 w-full rounded-3xl border border-ink/15 bg-white p-5 text-lg outline-none focus:border-ocean"
          />
          <div className="mt-5 space-y-3">
            <PrimaryCTA
              disabled={editingText.trim().length < 2}
              onClick={continueWithText}
            >
              Continue with text
            </PrimaryCTA>
            <SecondaryCTA onClick={() => setTextFallback(false)}>
              Back to microphone
            </SecondaryCTA>
          </div>
        </section>
      </PatientShell>
    );
  }

  const status = recorder.state.status;
  const reviewing = status === "AWAITING_CONFIRMATION" || status === "EDITING";
  const waiting = [
    "PERMISSION_REQUEST",
    "READY",
    "STOPPING",
    "UPLOADING",
    "TRANSCRIBING",
    "TRANSCRIBED",
  ].includes(status);
  const waitingLabel: Record<string, string> = {
    PERMISSION_REQUEST: "Getting microphone ready…",
    READY: "Getting microphone ready…",
    STOPPING: "Finishing recording…",
    UPLOADING: "Sending your answer securely…",
    TRANSCRIBING: "Turning speech into text…",
    TRANSCRIBED: "Preparing your words…",
  };

  return (
    <PatientShell
      activeStep={isQuestionAnswer ? 2 : 1}
      backHref={isQuestionAnswer ? "/patient/interview" : "/patient/complaint"}
      eyebrow="Secure voice input"
    >
      <section className="mx-auto max-w-2xl text-center">
        {status === "IDLE" && (
          <>
            <h1 className="font-serif text-4xl sm:text-5xl">
              {isQuestionAnswer
                ? "Say your answer"
                : "Tell us what you are feeling"}
            </h1>
            <p className="mt-3 text-lg text-ink/60">
              Speak naturally in English or Hindi.
            </p>
            <div className="mt-9 flex justify-center">
              <VoiceButton onClick={() => void recorder.start()} />
            </div>
            <p className="mt-5 font-bold text-ocean">Tap to speak</p>
            <button
              type="button"
              onClick={() => setTextFallback(true)}
              className="mt-5 min-h-11 rounded-xl px-4 font-bold text-ocean hover:bg-mist"
            >
              Type instead
            </button>
          </>
        )}
        {status === "RECORDING" && (
          <>
            <h1 className="font-serif text-4xl">Listening…</h1>
            <p className="mt-3 text-lg text-ink/60">हम सुन रहे हैं…</p>
            <div className="mt-8 flex justify-center">
              <VoiceButton active onClick={recorder.stop} />
            </div>
            <VoiceWaveform levels={recorder.state.levels} />
            <p className="font-mono text-lg">
              {formatTime(recorder.state.elapsedSeconds)}
            </p>
            <div className="mx-auto mt-6 grid max-w-md gap-3 sm:grid-cols-2">
              <PrimaryCTA onClick={recorder.stop}>Stop recording</PrimaryCTA>
              <SecondaryCTA onClick={recorder.cancel}>Cancel</SecondaryCTA>
            </div>
          </>
        )}
        {waiting && (
          <div className="py-16" role="status">
            <span className="mx-auto block h-14 w-14 animate-spin rounded-full border-4 border-ocean/20 border-t-ocean" />
            <h1 className="mt-7 font-serif text-3xl">
              {waitingLabel[status] ?? "Preparing your answer…"}
            </h1>
            <SecondaryCTA
              onClick={() => {
                recorder.cancel();
                setTextFallback(true);
              }}
            >
              Cancel and type instead
            </SecondaryCTA>
          </div>
        )}
        {status === "ERROR" && (
          <div
            role="alert"
            className="rounded-3xl border border-red-200 bg-red-50 p-7 text-left"
          >
            <h1 className="font-serif text-3xl text-red-950">
              We couldn’t understand that
            </h1>
            <p className="mt-3 text-red-900">
              {recorder.state.errorMessage ??
                "Voice wasn’t available. Try again or type your answer instead."}
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <PrimaryCTA
                onClick={() => {
                  recorder.cancel();
                  void recorder.start();
                }}
              >
                Try again
              </PrimaryCTA>
              <SecondaryCTA onClick={() => setTextFallback(true)}>
                Type instead
              </SecondaryCTA>
            </div>
          </div>
        )}
        {reviewing && interaction && (
          <>
            <p className="text-sm font-bold uppercase tracking-wide text-teal">
              You said
            </p>
            <h1 className="mt-3 font-serif text-4xl">Does this sound right?</h1>
            <div className="mt-7 rounded-3xl border border-ink/10 bg-white p-6 text-left shadow-soft">
              {status === "EDITING" ? (
                <textarea
                  aria-label="Edit what you said"
                  maxLength={4000}
                  value={editingText}
                  onChange={(event) => setEditingText(event.target.value)}
                  className="min-h-36 w-full rounded-xl border border-ocean p-4 text-lg"
                />
              ) : (
                <blockquote className="text-xl leading-9">
                  “
                  {interaction.patientEditedTranscript ??
                    interaction.originalTranscript}
                  ”
                </blockquote>
              )}
            </div>
            {actionError && (
              <p role="alert" className="mt-4 text-red-800">
                {actionError}
              </p>
            )}
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {status === "EDITING" ? (
                <>
                  <PrimaryCTA
                    loading={busy}
                    disabled={editingText.trim().length < 2}
                    onClick={() => void saveEdit()}
                  >
                    Save changes
                  </PrimaryCTA>
                  <SecondaryCTA
                    disabled={busy}
                    onClick={() => {
                      setEditingText(
                        interaction.patientEditedTranscript ??
                          interaction.originalTranscript ??
                          "",
                      );
                      setActionError("");
                      recorder.dispatch({ type: "AWAIT_CONFIRMATION" });
                    }}
                  >
                    Cancel edit
                  </SecondaryCTA>
                </>
              ) : (
                <>
                  <PrimaryCTA
                    loading={busy}
                    onClick={() => void confirmTranscript()}
                  >
                    ✓ Sounds right
                  </PrimaryCTA>
                  <SecondaryCTA
                    disabled={busy}
                    onClick={() => recorder.dispatch({ type: "EDIT" })}
                  >
                    ✎ Edit text
                  </SecondaryCTA>
                </>
              )}
              <SecondaryCTA
                disabled={busy}
                onClick={() => {
                  setActionError("");
                  recorder.cancel();
                }}
              >
                ↻ Try again
              </SecondaryCTA>
            </div>
          </>
        )}
      </section>
    </PatientShell>
  );
}

function formatTime(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function message(reason: unknown) {
  if (reason instanceof ApiRequestError) return reason.message;
  return "Voice input could not be completed. Please try again or type your answer.";
}
