"use client";

import type { InterviewDto, InterviewQuestionDto } from "@helios/shared";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { VoiceWaveform } from "@/components/patient/voice";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { interviewService } from "@/services/interview-service";
import { ApiRequestError } from "@/services/patient-flow";
import { voiceService } from "@/services/voice-service";

type ConversationPhase =
  | "ASKING"
  | "LISTENING"
  | "PROCESSING"
  | "UNDERSTANDING"
  | "SUCCESS"
  | "RETRY";

export function VoiceConversationController({
  interview,
  question,
  language,
  sessionId,
  sessionToken,
  onAdvance,
  onUseText,
}: Readonly<{
  interview: InterviewDto;
  question: InterviewQuestionDto;
  language: "en" | "hi";
  sessionId: string;
  sessionToken: string;
  onAdvance(value: InterviewDto): void;
  onUseText(): void;
}>) {
  const [phase, setPhase] = useState<ConversationPhase>("ASKING");
  const [notice, setNotice] = useState("");
  const [retryInstruction, setRetryInstruction] = useState<string | null>(null);
  const spokenQuestionRef = useRef("");
  const speechGenerationRef = useRef(0);
  const retryPrompt =
    language === "hi"
      ? "माफ़ कीजिए, मुझे समझ नहीं आया। कृपया दोबारा बताइए।"
      : "Sorry, I did not understand that. Please say it again.";
  const optionRetryPrompt =
    language === "hi"
      ? "कृपया दिए गए विकल्पों में से एक विकल्प बोलें।"
      : "Please say one of the listed options.";

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
        const transcript = interaction.originalTranscript ?? interaction.acceptedTranscript;
        if (!transcript) throw new ApiRequestError("No transcript was received.");
        const answer = resolveSpokenOption(transcript, question, language);
        if (hasFixedOptions(question) && !answer) {
          setPhase("RETRY");
          setNotice(optionRetryPrompt);
          setRetryInstruction(optionRetryPrompt);
          return;
        }
        // Do not persist a voice interaction as patient-confirmed when its
        // transcript is not one of the choices the question permits.
        await voiceService.confirm(interaction.id, sessionToken);
        const preview = await interviewService.respond(
          interview.id,
          { questionId: question.id, rawAnswer: answer ?? transcript, language },
          sessionToken,
        );
        setPhase("UNDERSTANDING");
        const updated = await interviewService.confirm(
          interview.id,
          preview.response.id,
          sessionToken,
        );
        setPhase("SUCCESS");
        setNotice(
          preview.clarificationMessage ||
            preview.response.status === "NEEDS_CLARIFICATION"
            ? language === "hi"
              ? "एक छोटी पुष्टि और…"
              : "One quick clarification…"
            : language === "hi"
              ? "समझ गया ✓"
              : "Got it ✓",
        );
        window.setTimeout(() => onAdvance(updated), 550);
      } catch (error) {
        const errorMessage = message(error);
        dispatch({
          type: "FAIL",
          code: "CONVERSATION_FAILED",
          message: errorMessage,
        });
        setPhase("RETRY");
        setNotice(errorMessage);
        if (isNoAnswerError(errorMessage)) setRetryInstruction(retryPrompt);
      }
    },
    [
      interview.id,
      language,
      onAdvance,
      optionRetryPrompt,
      question,
      retryPrompt,
      sessionId,
      sessionToken,
    ],
  );

  const recorder = useVoiceRecorder(handleRecording, {
    autoStopOnSilence: true,
    silenceMs: 1300,
  });
  const startRecording = recorder.start;

  useEffect(() => {
    if (recorder.state.status !== "ERROR") return;
    setPhase("RETRY");
    const errorMessage =
      recorder.state.errorMessage ??
      "Voice input could not be completed. Please try again or type your answer.";
    setNotice(errorMessage);
    if (isNoAnswerError(errorMessage)) setRetryInstruction(retryPrompt);
  }, [recorder.state.errorMessage, recorder.state.status, retryPrompt]);

  const startListening = useCallback(() => {
      setPhase("LISTENING");
      setNotice(language === "hi" ? "हम सुन रहे हैं…" : "Listening…");
      setRetryInstruction(null);
    void startRecording();
  }, [language, startRecording]);

  const speakThenListen = useCallback(
    (text: string) => {
      const generation = ++speechGenerationRef.current;
      setPhase("ASKING");
      setNotice(language === "hi" ? "सवाल बोल रहे हैं…" : "Asking your question…");
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
    },
    [language, startListening],
  );

  useEffect(() => {
    const key = `${interview.id}:${question.id}:${language}`;
    if (spokenQuestionRef.current === key) return;
    spokenQuestionRef.current = key;
    speakThenListen(spokenQuestion(question, language));
    return () => {
      // Strict Mode mounts, cleans up, then mounts again in development.
      // Resetting the marker lets the surviving effect ask the question.
      if (spokenQuestionRef.current === key) spokenQuestionRef.current = "";
      speechGenerationRef.current += 1;
      window.speechSynthesis?.cancel();
    };
  }, [interview.id, language, question, question.id, question.text, speakThenListen]);

  useEffect(() => {
    if (phase !== "RETRY" || !retryInstruction) return;
    const timer = window.setTimeout(() => speakThenListen(retryInstruction), 700);
    return () => window.clearTimeout(timer);
  }, [phase, retryInstruction, speakThenListen]);

  const label: Record<ConversationPhase, string> = {
    ASKING: language === "hi" ? "बोल रहे हैं" : "SPEAKING",
    LISTENING: language === "hi" ? "सुन रहे हैं" : "LISTENING",
    PROCESSING: language === "hi" ? "प्रोसेस हो रहा है" : "PROCESSING",
    UNDERSTANDING: language === "hi" ? "समझ रहे हैं" : "UNDERSTANDING",
    SUCCESS: language === "hi" ? "समझ गया" : "SUCCESS",
    RETRY: language === "hi" ? "फिर से कोशिश" : "RETRY",
  };

  return (
    <section aria-live="polite" className="mx-auto max-w-3xl text-center">
      <div className="grid items-center gap-4 rounded-[2rem] border border-ocean/15 bg-white p-5 shadow-soft sm:grid-cols-[190px_1fr] sm:p-7">
        <Image
          src="/helios-conversation-doctor.png"
          alt="HELIOS conversation guide"
          width={800}
          height={800}
          className={`mx-auto w-40 rounded-3xl object-cover transition-transform duration-500 ${phase === "ASKING" ? "motion-safe:animate-pulse" : ""}`}
        />
        <div className="relative rounded-3xl border-2 border-ink bg-mist p-6 text-left before:absolute before:-left-3 before:top-10 before:h-5 before:w-5 before:rotate-45 before:border-b-2 before:border-l-2 before:border-ink before:bg-mist">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal">HELIOS asks</p>
          <h1 className="mt-3 font-serif text-3xl leading-tight sm:text-4xl">{question.text}</h1>
          {question.alternativeText && <p className="mt-3 text-ink/60">{question.alternativeText}</p>}
          {hasSpokenOptions(question) && (
            <div className="mt-4 flex flex-wrap gap-2" aria-label="Spoken answer options">
              {question.options?.map((option) => (
                <span key={option} className="rounded-full bg-white px-3 py-1 text-sm font-bold text-ocean shadow-sm">{option}</span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-6 rounded-3xl bg-ocean p-5 text-white shadow-soft">
        <p className="text-xs font-black tracking-[0.22em]">{label[phase]}</p>
        {phase === "LISTENING" && <VoiceWaveform levels={recorder.state.levels} />}
        <p className="mt-2 text-lg font-bold">{notice}</p>
        <p className="mt-2 text-sm text-white/75">
          {phase === "LISTENING"
            ? language === "hi"
              ? "बोलना समाप्त करें; HELIOS अपने आप सुनना बंद कर देगा।"
              : "Finish speaking; HELIOS will stop listening automatically."
            : `${Math.round(interview.completeness)}% complete`}
        </p>
      </div>
      {phase === "RETRY" && notice !== retryPrompt && (
        <button type="button" onClick={startListening} className="mt-4 min-h-11 rounded-xl bg-ocean px-5 font-bold text-white">Try voice again</button>
      )}
      <button type="button" onClick={onUseText} className="mt-4 min-h-11 rounded-xl px-4 text-sm font-bold text-ocean underline">{language === "hi" ? "टाइप करके जवाब दें" : "Type instead"}</button>
    </section>
  );
}

function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Voice input could not be completed. Please try again or type your answer.";
}

function hasFixedOptions(question: InterviewQuestionDto) {
  return ["CHOICE", "YES_NO", "MULTI_SELECT"].includes(question.inputType) && Boolean(question.options?.length);
}

function hasSpokenOptions(question: InterviewQuestionDto) {
  return (hasFixedOptions(question) || question.inputType === "DURATION") && Boolean(question.options?.length);
}

function spokenQuestion(question: InterviewQuestionDto, language: "en" | "hi") {
  if (question.inputType === "SLIDER")
    return language === "hi"
      ? `${question.text} कृपया शून्य से दस तक सिर्फ़ एक संख्या बोलें।`
      : `${question.text} Please say one number from zero to ten.`;
  if (!hasSpokenOptions(question)) return question.text;
  const options = question.options!.join(", ");
  return language === "hi"
    ? `${question.text} विकल्प हैं: ${options}. कृपया एक विकल्प बोलें।`
    : `${question.text} Your options are: ${options}. Please say one option.`;
}

function resolveSpokenOption(
  transcript: string,
  question: InterviewQuestionDto,
  language: "en" | "hi",
) {
  if (!hasFixedOptions(question)) return transcript;
  const heard = normalize(transcript);
  const values = question.optionValues ?? question.options ?? [];
  const optionIndex = spokenOptionIndex(heard, language);
  if (optionIndex !== null && values[optionIndex]) return values[optionIndex];
  const exact = values.find((value, index) => {
    const spoken = normalize(question.options?.[index] ?? value);
    const normalizedValue = normalize(value);
    return heard === spoken || heard === normalizedValue;
  });
  if (exact) return exact;
  const matches = values.filter((value, index) => {
    const spoken = normalize(question.options?.[index] ?? value);
    const normalizedValue = normalize(value);
    return Boolean(spoken && spoken.length >= 3 && containsPhrase(heard, spoken)) ||
      Boolean(normalizedValue && normalizedValue.length >= 3 && containsPhrase(heard, normalizedValue));
  });
  if (!matches.length) return null;
  return question.inputType === "MULTI_SELECT" ? matches.join(", ") : matches[0]!;
}

function spokenOptionIndex(heard: string, language: "en" | "hi") {
  const match = heard.match(/^(?:option|choice|विकल्प)\s*(?:number\s*)?(10|[1-9])$/);
  if (match) return Number(match[1]) - 1;
  const withoutPrefix = heard.replace(/^(?:option|choice|विकल्प)\s+/, "");
  const ordinals: Record<string, number> = {
    first: 0,
    one: 0,
    second: 1,
    two: 1,
    third: 2,
    three: 2,
    fourth: 3,
    four: 3,
    fifth: 4,
    five: 4,
    sixth: 5,
    six: 5,
    seventh: 6,
    seven: 6,
    eighth: 7,
    eight: 7,
    ninth: 8,
    nine: 8,
    tenth: 9,
    ten: 9,
    पहला: 0,
    पहली: 0,
    दूसरा: 1,
    दूसरी: 1,
    तीसरा: 2,
    तीसरी: 2,
    चौथा: 3,
    चौथी: 3,
    पांचवां: 4,
    पाँचवां: 4,
  };
  // The mapping is intentionally language-independent: English ordinal
  // fallback remains correct when the selected interface is Hindi.
  void language;
  return ordinals[withoutPrefix] ?? null;
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsPhrase(text: string, phrase: string) {
  return new RegExp(`(?:^|\\s)${escapeRegExp(phrase)}(?:$|\\s)`).test(text);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isNoAnswerError(value: string) {
  return /no speech|empty recording|no transcript|did not understand|couldn.?t understand|could not understand|transcript empty/i.test(value);
}
