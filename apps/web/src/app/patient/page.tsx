"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorState } from "@/components/patient/feedback";
import { PrimaryCTA, SecondaryCTA } from "@/components/patient/controls";
import { PatientShell } from "@/components/patient/patient-shell";
import { WelcomeIllustration } from "@/components/patient/welcome-illustration";
import { stepRoutes, usePatientFlow } from "@/providers/patient-flow-provider";
import { useTranslation } from "@/i18n/use-translation";

export default function PatientWelcomePage() {
  const router = useRouter();
  const flow = usePatientFlow();
  const { language } = useTranslation();
  const [busy, setBusy] = useState<"start" | "resume" | null>(null);
  const [error, setError] = useState("");

  async function start() {
    setBusy("start");
    setError("");
    try {
      await flow.start();
      router.push("/patient/language");
    } catch {
      setError("We couldn’t start your check-in. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function resume() {
    setBusy("resume");
    setError("");
    try {
      const session = await flow.resume();
      router.push(stepRoutes[session.currentStep]);
    } catch {
      setError("We couldn’t find your previous session. You can start again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <PatientShell>
      <div className="mx-auto grid max-w-5xl items-center gap-8 lg:grid-cols-[1fr_.9fr]">
        <section className="text-center lg:text-left">
          <p className="helios-eyebrow">
            {language === "hi"
              ? "डॉक्टर से मिलने से पहले"
              : "Before you see the doctor"}
          </p>
          <h1 className="mt-4 font-serif text-4xl font-bold leading-tight sm:text-5xl">
            {language === "hi"
              ? "डॉक्टर से मिलने से पहले अपनी बात बताएं।"
              : "Tell us how you’re feeling."}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-ink/65 lg:mx-0">
            {language === "hi"
              ? "हम आपकी जानकारी व्यवस्थित करेंगे ताकि डॉक्टर आपकी बात जल्दी समझ सकें।"
              : "We’ll help collect your health information before you meet the doctor. Speak or type in your own words."}
          </p>
          <div className="mx-auto mt-8 max-w-md space-y-3 lg:mx-0">
            {error && (
              <ErrorState message={error} onRetry={() => void start()} />
            )}
            <PrimaryCTA loading={busy === "start"} onClick={() => void start()}>
              {busy === "start"
                ? "Preparing your session…"
                : language === "hi"
                  ? "शुरू करें"
                  : "Start check-in"}
            </PrimaryCTA>
            <SecondaryCTA
              disabled={!flow.state.sessionId || busy !== null}
              onClick={() => void resume()}
            >
              {busy === "resume"
                ? language === "hi"
                  ? "आपका पिछला सत्र खोज रहे हैं…"
                  : "Finding your session…"
                : language === "hi"
                  ? "पिछला सत्र जारी रखें"
                  : "Continue previous session"}
            </SecondaryCTA>
          </div>
          <p className="mt-5 text-sm text-ink/70">
            {language === "hi"
              ? "अगला चरण: अपनी भाषा चुनें।"
              : "Next: choose English or हिन्दी."}
          </p>
        </section>
        <div className="mx-auto w-full max-w-xl">
          <WelcomeIllustration />
        </div>
      </div>
    </PatientShell>
  );
}
