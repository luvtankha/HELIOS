"use client";

import type {
  InterviewDto,
  InterviewQuestionDto,
  InterviewResponsePreviewDto,
} from "@helios/shared";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AnswerOption,
  PrimaryCTA,
  SecondaryCTA,
} from "@/components/patient/controls";
import { VoiceConversationController } from "@/components/patient/voice-conversation-controller";
import { PatientShell } from "@/components/patient/patient-shell";
import { useSessionGuard } from "@/hooks/use-session-guard";
import { interviewService } from "@/services/interview-service";
import { useTranslation } from "@/i18n/use-translation";

export default function InterviewPage() {
  const router = useRouter();
  const flow = useSessionGuard();
  const { language, t } = useTranslation();
  const [interview, setInterview] = useState<InterviewDto | null>(null);
  const [preview, setPreview] = useState<InterviewResponsePreviewDto | null>(
    null,
  );
  const [answer, setAnswer] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [initializationAttempt, setInitializationAttempt] = useState(0);
  const [textFallback, setTextFallback] = useState(false);

  useEffect(() => {
    if (!flow.state.hydrated) return;
    // Do not create or fetch an interview from unvalidated browser storage.
    // The guard first verifies the signed session with the API.
    if (flow.sessionReady === false) return;
    const voiceText = sessionStorage.getItem("helios.interview.voice-text");
    if (voiceText) {
      setAnswer(voiceText);
      sessionStorage.removeItem("helios.interview.voice-text");
      flow.setPendingQuestionId(null);
    }
    const { sessionId, sessionToken, complaint, language, interviewId } =
      flow.state;
    if (!sessionId || !sessionToken) return;
    if (!complaint) {
      router.replace("/patient/complaint");
      return;
    }
    let active = true;
    setBusy(true);
    setError("");
    const operation = interviewId
      ? interviewService.get(interviewId, sessionToken)
      : interviewService.create(
          { sessionId, chiefComplaint: complaint, language },
          sessionToken,
        );
    void operation
      .then((value) => {
        if (!active) return;
        setInterview(value);
        flow.setInterviewId(value.id);
      })
      .catch((reason: unknown) => {
        if (active) setError(message(reason));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
    // Wait for persisted session hydration. Saving interviewId must not restart initialization.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    flow.state.hydrated,
    flow.state.sessionId,
    flow.state.sessionToken,
    flow.state.complaint,
    flow.state.language,
    flow.sessionReady,
    initializationAttempt,
  ]);

  const question = interview?.currentQuestion;
  const rawAnswer = useMemo(
    () =>
      question?.inputType === "MULTI_SELECT"
        ? selected.join(", ")
        : answer,
    [answer, question?.inputType, selected],
  );

  async function submitAnswer() {
    if (!interview || !question || !flow.state.sessionToken || !rawAnswer)
      return;
    setBusy(true);
    setError("");
    try {
      setPreview(
        await interviewService.respond(
          interview.id,
          { questionId: question.id, rawAnswer, language: flow.state.language },
          flow.state.sessionToken,
        ),
      );
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }

  async function confirmAnswer() {
    if (!interview || !preview || !flow.state.sessionToken) return;
    setBusy(true);
    setError("");
    try {
      const updated = await interviewService.confirm(
        interview.id,
        preview.response.id,
        flow.state.sessionToken,
      );
      setInterview(updated);
      syncAnswers(updated);
      setPreview(null);
      setAnswer("");
      setSelected([]);
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!interview || !flow.state.sessionToken) return;
    setBusy(true);
    setError("");
    try {
      const completed = await interviewService.complete(
        interview.id,
        flow.state.sessionToken,
      );
      syncAnswers(completed);
      await flow.saveInterview();
      router.push("/patient/review");
    } catch (reason) {
      setError(message(reason));
      setBusy(false);
    }
  }

  async function revise(field: string) {
    if (!interview || !flow.state.sessionToken) return;
    setBusy(true);
    setError("");
    try {
      setInterview(
        await interviewService.revise(
          interview.id,
          field,
          flow.state.sessionToken,
        ),
      );
      setAnswer("");
      setSelected([]);
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }

  if (busy && !interview) {
    return (
      <PatientShell
        activeStep={2}
        backHref="/patient/complaint"
        eyebrow="Building your health history…"
      >
        <div className="py-20 text-center" role="status">
          <span className="mx-auto block h-12 w-12 animate-spin rounded-full border-4 border-ocean/20 border-t-ocean" />
          <p className="mt-5 text-lg">Preparing your next question…</p>
        </div>
      </PatientShell>
    );
  }

  if (!interview) {
    return (
      <PatientShell
        activeStep={2}
        backHref="/patient/complaint"
        eyebrow="Your answers are safe"
      >
        <ErrorPanel
          error={error || "We couldn't start the interview."}
          onRetry={() => setInitializationAttempt((attempt) => attempt + 1)}
        />
      </PatientShell>
    );
  }

  if (interview.status === "REVIEW" || !question) {
    return (
      <PatientShell
        activeStep={2}
        backHref="/patient/complaint"
        eyebrow="Pre-final review"
      >
        <section className="mx-auto max-w-3xl">
          <div className="text-center">
            <p className="text-sm font-bold text-teal">
              {interview.completenessMessage}
            </p>
            <h1 className="mt-3 font-serif text-4xl sm:text-5xl">
              {language === "hi"
                ? "हमने जो समझा है उसकी समीक्षा करें"
                : "Please review what we understood"}
            </h1>
            <p className="mt-4 text-ink/60">
              These are patient-reported facts, not a diagnosis.
            </p>
          </div>
          <div className="mt-8 space-y-3">
            {Object.entries(interview.state.facts).map(([field, fact]) => (
              <div
                key={field}
                className="flex items-center justify-between gap-4 rounded-2xl border border-ink/10 bg-white p-5 shadow-soft"
              >
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-ink/45">
                    {label(field)}
                  </p>
                  <p className="mt-2 text-lg">
                    {display(fact.value ?? fact.state)}
                  </p>
                  {fact.state === "UNKNOWN" && (
                    <p className="mt-1 text-sm text-amber-800">Not sure</p>
                  )}
                </div>
                {field !== "chiefComplaint" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void revise(field)}
                    className="min-h-11 shrink-0 rounded-xl px-3 text-sm font-bold text-ocean hover:bg-mist disabled:opacity-50"
                  >
                    Change answer
                  </button>
                )}
              </div>
            ))}
          </div>
          {error && (
            <p role="alert" className="mt-5 text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="mt-7 space-y-3">
            <PrimaryCTA loading={busy} onClick={() => void finish()}>
              {t("common.continue")}
            </PrimaryCTA>
            <SecondaryCTA onClick={() => router.push("/patient/complaint")}>
              Change my main concern
            </SecondaryCTA>
          </div>
        </section>
      </PatientShell>
    );
  }

  return (
    <PatientShell
      activeStep={2}
      backHref="/patient/complaint"
      eyebrow="Building your health history…"
    >
      <section className="mx-auto max-w-6xl">
        <div
          className="mb-7 rounded-xl border border-teal/20 bg-white px-4 py-3 text-sm text-ink/70"
          role="status"
        >
          <strong className="text-teal">
            {language === "hi" ? "स्वास्थ्य इतिहास" : "Health history"}
          </strong>
          <span className="ml-2">{interview.completenessMessage}</span>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
          <div>
            {!preview && !textFallback ? (
              <VoiceConversationController
                interview={interview}
                question={question}
                language={flow.state.language}
                sessionId={flow.state.sessionId!}
                sessionToken={flow.state.sessionToken!}
                onAdvance={(updated) => {
                  setInterview(updated);
                  syncAnswers(updated);
                  setAnswer("");
                  setSelected([]);
                }}
                onUseText={() => setTextFallback(true)}
              />
            ) : preview ? (
              <ConfirmationPanel language={flow.state.language} preview={preview} />
            ) : (
              <div className="rounded-3xl border border-ink/10 bg-white p-6 shadow-soft">
                <p className="font-bold">{language === "hi" ? "टाइप करके जवाब दें" : "Type your answer"}</p>
                <p className="mt-2 text-sm text-ink/60">{language === "hi" ? "वॉइस बातचीत रोक दी गई है। फॉर्म में जवाब दें।" : "Voice conversation is paused. Answer in the live form."}</p>
                <button type="button" onClick={() => setTextFallback(false)} className="mt-4 min-h-10 rounded-lg px-3 text-sm font-bold text-ocean underline">{language === "hi" ? "वॉइस पर लौटें" : "Return to voice"}</button>
              </div>
            )}
          </div>
          <LiveInterviewForm
            interview={interview}
            question={question}
            language={flow.state.language}
            answer={answer}
            selected={selected}
            rawAnswer={rawAnswer}
            preview={preview}
            busy={busy}
            onAnswer={setAnswer}
            onToggle={(option) =>
              setSelected((current) =>
                current.includes(option)
                  ? current.filter((item) => item !== option)
                  : ["None of these", "Not sure"].includes(option)
                    ? [option]
                    : [...current.filter((item) => !["None of these", "Not sure"].includes(item)), option],
              )
            }
            onReview={() => void submitAnswer()}
            onConfirm={() => void confirmAnswer()}
            onEdit={() => setPreview(null)}
            reviewLabel={t("common.review")}
            confirmLabel={t("interview.confirm")}
            editLabel={t("common.edit")}
          />
        </div>
        {error && <p role="alert" className="mt-5 text-sm text-red-700">{error}</p>}
        <p className="mt-5 text-center text-sm text-ink/50">
          This interview organizes what you report. It does not diagnose or
          recommend treatment.
        </p>
      </section>
    </PatientShell>
  );

  function syncAnswers(updated: InterviewDto) {
    for (const [field, fact] of Object.entries(updated.state.facts)) {
      if (fact.value !== undefined) flow.setAnswer(field, display(fact.value));
    }
  }
}

function ConfirmationPanel({
  language,
  preview,
}: {
  language: "en" | "hi";
  preview: InterviewResponsePreviewDto;
}) {
  return (
    <div className="rounded-[2rem] border border-teal/30 bg-white p-6 shadow-soft">
      <p className="text-sm font-bold uppercase tracking-wide text-teal">
        {language === "hi" ? "कृपया पुष्टि करें" : "Please confirm"}
      </p>
      <h1 className="mt-2 font-serif text-3xl">
        {language === "hi" ? "क्या यह सही है?" : "Is this correct?"}
      </h1>
      <p className="mt-5 text-lg">{display(normalizedValue(preview))}</p>
      {preview.clarificationMessage && (
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          {preview.clarificationMessage}
        </p>
      )}
      <p className="mt-4 text-sm text-ink/50">
        We only add this to your history after you confirm it.
      </p>
    </div>
  );
}

function LiveInterviewForm({
  interview,
  question,
  language,
  answer,
  selected,
  rawAnswer,
  preview,
  busy,
  onAnswer,
  onToggle,
  onReview,
  onConfirm,
  onEdit,
  reviewLabel,
  confirmLabel,
  editLabel,
}: {
  interview: InterviewDto;
  question: InterviewQuestionDto;
  language: "en" | "hi";
  answer: string;
  selected: string[];
  rawAnswer: string;
  preview: InterviewResponsePreviewDto | null;
  busy: boolean;
  onAnswer(value: string): void;
  onToggle(value: string): void;
  onReview(): void;
  onConfirm(): void;
  onEdit(): void;
  reviewLabel: string;
  confirmLabel: string;
  editLabel: string;
}) {
  return (
    <aside className="rounded-3xl border border-ink/10 bg-white p-5 shadow-soft" aria-label="Live health form">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal">{language === "hi" ? "लाइव स्वास्थ्य फॉर्म" : "Live health form"}</p>
          <p className="mt-1 text-sm text-ink/60">{language === "hi" ? "आपकी बात से अपने आप भर रहा है" : "Updates as HELIOS understands you"}</p>
        </div>
        <span className="rounded-full bg-teal/10 px-3 py-1 text-xs font-bold text-teal">{Math.round(interview.completeness)}%</span>
      </div>
      <div className="mt-5 space-y-2" aria-live="polite">
        {Object.entries(interview.state.facts).length ? (
          Object.entries(interview.state.facts).map(([field, fact]) => (
            <div key={field} className="flex items-center justify-between gap-3 rounded-xl bg-mist px-3 py-2">
              <span className="text-xs font-bold uppercase tracking-wide text-ink/55">{label(field)}</span>
              <span className="text-right text-sm font-bold text-ink">{display(fact.value ?? fact.state)} <span className="text-teal">✓</span></span>
            </div>
          ))
        ) : (
          <p className="rounded-xl bg-mist p-3 text-sm text-ink/60">{language === "hi" ? "आपका उत्तर यहाँ दिखाई देगा।" : "Your accepted answers will appear here."}</p>
        )}
      </div>
      {!preview && (
        <div className="mt-6 border-t border-ink/10 pt-5">
          <QuestionCard question={question} answer={answer} selected={selected} onAnswer={onAnswer} onToggle={onToggle} />
          <div className="mt-5">
            <PrimaryCTA disabled={!rawAnswer} loading={busy} onClick={onReview}>{reviewLabel}</PrimaryCTA>
          </div>
        </div>
      )}
      {preview && (
        <div className="mt-6 space-y-3 border-t border-ink/10 pt-5">
          <PrimaryCTA loading={busy} onClick={onConfirm}>✓ {confirmLabel}</PrimaryCTA>
          <SecondaryCTA onClick={onEdit}>{editLabel}</SecondaryCTA>
        </div>
      )}
    </aside>
  );
}

function QuestionCard(props: {
  question: InterviewQuestionDto;
  answer: string;
  selected: string[];
  onAnswer(value: string): void;
  onToggle(value: string): void;
}) {
  const { question } = props;
  const { language } = useTranslation();
  const choice =
    question.inputType === "CHOICE" ||
    question.inputType === "YES_NO" ||
    question.inputType === "DURATION";
  return (
    <div>
      <p className="text-center text-sm font-bold text-teal">
        {language === "hi" ? "अगला सवाल" : "Your next question"}
      </p>
      <h2 className="mt-3 text-center font-serif text-2xl sm:text-3xl">
        {language === "hi" ? "लाइव फॉर्म में उत्तर" : "Answer in the live form"}
      </h2>
      {question.alternativeText && (
        <p className="mt-3 text-center text-ink/55">
          {question.alternativeText}
        </p>
      )}
      {(choice || question.inputType === "MULTI_SELECT") && (
        <div className="mt-8 space-y-3">
          {question.options?.map((option, index) => {
            const value = question.optionValues?.[index] ?? option;
            const active =
              question.inputType === "MULTI_SELECT"
                ? props.selected.includes(value)
                : props.answer === value;
            return (
              <AnswerOption
                key={value}
                selected={active}
                onClick={() =>
                  question.inputType === "MULTI_SELECT"
                    ? props.onToggle(value)
                    : props.onAnswer(value)
                }
              >
                {option}
              </AnswerOption>
            );
          })}
        </div>
      )}
      {question.inputType === "SLIDER" && (
        <div className="mt-10 rounded-3xl bg-white p-6 shadow-soft">
          <output
            className="block text-center font-serif text-5xl"
            htmlFor="severity"
          >
            {props.answer || "—"}
          </output>
          <input
            id="severity"
            aria-label="Severity from 0 to 10"
            type="range"
            min="0"
            max="10"
            value={props.answer || "5"}
            onChange={(event) => props.onAnswer(event.target.value)}
            className="mt-7 w-full accent-teal"
          />
          <div className="mt-2 flex justify-between text-sm text-ink/50">
            <span>0 — none</span>
            <span>10 — strongest</span>
          </div>
        </div>
      )}
      {["TEXT", "LONG_TEXT", "NUMBER", "DATE"].includes(question.inputType) && (
        <div className="mt-8">
          <label htmlFor="interview-answer" className="block text-sm font-bold">
            {language === "hi" ? "आपका जवाब" : "Your answer"}
          </label>
          <textarea
            id="interview-answer"
            maxLength={4000}
            value={props.answer}
            onChange={(event) => props.onAnswer(event.target.value)}
            className="mt-2 min-h-32 w-full rounded-3xl border border-ink/15 bg-white p-5 text-lg outline-none focus:border-ocean"
          />
        </div>
      )}
    </div>
  );
}

function ErrorPanel({ error, onRetry }: { error: string; onRetry(): void }) {
  return (
    <div
      role="alert"
      className="mx-auto max-w-xl rounded-3xl border border-red-200 bg-red-50 p-7"
    >
      <h1 className="font-serif text-3xl text-red-950">
        We couldn’t load the interview
      </h1>
      <p className="mt-3 text-red-900">{error}</p>
      <div className="mt-5">
        <PrimaryCTA onClick={onRetry}>Try again</PrimaryCTA>
      </div>
    </div>
  );
}

function normalizedValue(preview: InterviewResponsePreviewDto) {
  const normalized = preview.response.normalizedAnswer as
    { value?: unknown; state?: string } | undefined;
  return normalized?.value ?? normalized?.state ?? preview.response.rawAnswer;
}
function display(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object")
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${item} ${key}`)
      .join(" ");
  if (value === true) return "Yes";
  if (value === false) return "No";
  return String(value);
}
function label(value: string) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
}
function message(reason: unknown) {
  void reason;
  return "The interview could not be updated. Please try again.";
}
