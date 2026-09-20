"use client";

import type { LanguageCode } from "@helios/shared";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { VoiceWaveform } from "@/components/patient/voice";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { ApiRequestError } from "@/services/patient-flow";
import { voiceService } from "@/services/voice-service";

type Phase = "ASKING" | "LISTENING" | "PROCESSING" | "SUCCESS" | "RETRY";

export function ComplaintVoiceConversation({
  language,
  sessionId,
  sessionToken,
  onComplaint,
  onUseText,
}: Readonly<{
  language: LanguageCode;
  sessionId: string;
  sessionToken: string;
  onComplaint(value: string): void;
  onUseText(): void;
}>) {
  const [phase, setPhase] = useState<Phase>("ASKING");
  const [notice, setNotice] = useState("");
  const [retryPrompt, setRetryPrompt] = useState<string | null>(null);
  const spokenQuestionRef = useRef("");
  const speechGenerationRef = useRef(0);
  const question = language === "hi"
    ? "कृपया बताइए कि आपको अभी कौन सी परेशानी हो रही है।"
    : "Please tell me what health problem you are experiencing today.";
  const retry = language === "hi"
    ? "माफ़ कीजिए, मुझे कोई जवाब सुनाई नहीं दिया। कृपया अपनी परेशानी दोबारा बताइए।"
    : "Sorry, I did not hear an answer. Please tell me your health problem again.";

  const handleRecording = useCallback(
    async (
      result: { blob: Blob; durationSeconds: number; signal: AbortSignal },
      dispatch: ReturnType<typeof useVoiceRecorder>["dispatch"],
    ) => {
      setPhase("PROCESSING");
      setNotice(language === "hi" ? "आपकी बात समझ रहे हैं…" : "Understanding your answer…");
      try {
        const interaction = await voiceService.recordAndTranscribe({
          audio: result.blob,
          sessionId,
          sessionToken,
          language,
          durationSeconds: result.durationSeconds,
          signal: result.signal,
          onProgress: (progress) => {
            dispatch({ type: "UPLOAD_PROGRESS", progress });
            if (progress === 100) dispatch({ type: "TRANSCRIBE" });
          },
        });
        dispatch({ type: "TRANSCRIPTION_COMPLETE", interaction });
        const confirmed = await voiceService.confirm(interaction.id, sessionToken);
        const transcript = confirmed.acceptedTranscript ?? interaction.originalTranscript;
        if (!transcript?.trim()) throw new ApiRequestError("No speech was heard.");
        setPhase("SUCCESS");
        setNotice(language === "hi" ? "समझ गया ✓" : "Got it ✓");
        window.setTimeout(() => onComplaint(transcript.trim()), 450);
      } catch (error) {
        const errorMessage = message(error);
        dispatch({ type: "FAIL", code: "COMPLAINT_VOICE_FAILED", message: errorMessage });
        setPhase("RETRY");
        setNotice(errorMessage);
        if (isNoAnswer(errorMessage)) setRetryPrompt(retry);
      }
    },
    [language, onComplaint, retry, sessionId, sessionToken],
  );

  const recorder = useVoiceRecorder(handleRecording, {
    autoStopOnSilence: true,
    silenceMs: 1300,
  });
  const startRecording = recorder.start;

  const startListening = useCallback(() => {
    setPhase("LISTENING");
    setNotice(language === "hi" ? "हम सुन रहे हैं…" : "Listening…");
    setRetryPrompt(null);
    void startRecording();
  }, [language, startRecording]);

  const speakThenListen = useCallback((text: string) => {
    const generation = ++speechGenerationRef.current;
    setPhase("ASKING");
    setNotice(language === "hi" ? "HELIOS सवाल पूछ रहा है…" : "HELIOS is asking…");
    if (!("speechSynthesis" in window)) {
      startListening();
      return;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume?.();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === "hi" ? "hi-IN" : "en-IN";
    utterance.rate = 0.95;
    utterance.onend = () => {
      if (speechGenerationRef.current === generation) startListening();
    };
    utterance.onerror = () => {
      if (speechGenerationRef.current === generation) startListening();
    };
    window.speechSynthesis.speak(utterance);
  }, [language, startListening]);

  useEffect(() => {
    const key = `${language}:${question}`;
    if (spokenQuestionRef.current === key) return;
    spokenQuestionRef.current = key;
    speakThenListen(question);
    return () => {
      if (spokenQuestionRef.current === key) spokenQuestionRef.current = "";
      speechGenerationRef.current += 1;
      window.speechSynthesis?.cancel();
    };
  }, [language, question, speakThenListen]);

  useEffect(() => {
    if (phase !== "RETRY" || !retryPrompt) return;
    const timer = window.setTimeout(() => speakThenListen(retryPrompt), 700);
    return () => window.clearTimeout(timer);
  }, [phase, retryPrompt, speakThenListen]);

  useEffect(() => {
    if (recorder.state.status !== "ERROR") return;
    const errorMessage = recorder.state.errorMessage ?? "Voice input could not be completed.";
    setPhase("RETRY");
    setNotice(errorMessage);
    if (isNoAnswer(errorMessage)) setRetryPrompt(retry);
  }, [recorder.state.errorMessage, recorder.state.status, retry]);

  return (
    <section aria-live="polite" className="mx-auto max-w-3xl text-center">
      <div className="grid items-center gap-4 rounded-[2rem] border border-ocean/15 bg-white p-5 shadow-soft sm:grid-cols-[190px_1fr] sm:p-7">
        <Image src="/helios-conversation-doctor.png" alt="HELIOS conversation guide" width={800} height={800} className={`mx-auto w-40 rounded-3xl object-cover transition-transform duration-500 ${phase === "ASKING" ? "motion-safe:animate-pulse" : ""}`} />
        <div className="relative rounded-3xl border-2 border-ink bg-mist p-6 text-left before:absolute before:-left-3 before:top-10 before:h-5 before:w-5 before:rotate-45 before:border-b-2 before:border-l-2 before:border-ink before:bg-mist">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal">HELIOS asks</p>
          <h1 className="mt-3 font-serif text-3xl leading-tight sm:text-4xl">{question}</h1>
        </div>
      </div>
      <div className="mt-6 rounded-3xl bg-ocean p-5 text-white shadow-soft">
        <p className="text-xs font-black tracking-[0.22em]">{phase}</p>
        {phase === "LISTENING" && <VoiceWaveform levels={recorder.state.levels} />}
        <p className="mt-2 text-lg font-bold">{notice}</p>
        <p className="mt-2 text-sm text-white/75">{phase === "LISTENING" ? (language === "hi" ? "बोलना समाप्त करें; HELIOS अपने आप सुनना बंद कर देगा।" : "Finish speaking; HELIOS will stop listening automatically.") : ""}</p>
      </div>
      {phase === "RETRY" && !retryPrompt && <button type="button" onClick={startListening} className="mt-4 min-h-11 rounded-xl bg-ocean px-5 font-bold text-white">Try voice again</button>}
      <button type="button" onClick={onUseText} className="mt-4 min-h-11 rounded-xl px-4 text-sm font-bold text-ocean underline">{language === "hi" ? "टाइप करके जवाब दें" : "Type instead"}</button>
    </section>
  );
}

function isNoAnswer(value: string) {
  return /no speech|empty recording|no transcript|did not hear|couldn.?t understand|could not understand|transcript empty/i.test(value);
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Voice input could not be completed. Please try again or type your answer.";
}
