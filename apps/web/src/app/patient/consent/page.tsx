"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConsentCard, PrimaryCTA } from "@/components/patient/controls";
import { ErrorState } from "@/components/patient/feedback";
import { PatientShell } from "@/components/patient/patient-shell";
import { useSessionGuard } from "@/hooks/use-session-guard";
import { useTranslation } from "@/i18n/use-translation";

export default function ConsentPage() {
  const router = useRouter();
  const flow = useSessionGuard();
  const { language, t } = useTranslation();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function continueFlow() {
    if (!accepted) return;
    setBusy(true);
    setError("");
    try {
      await flow.acceptConsent();
      router.push("/patient/details");
    } catch {
      setError("We couldn’t save your choice. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PatientShell
      backHref="/patient/language"
      eyebrow={
        language === "hi"
          ? "आपकी जानकारी, आपका नियंत्रण"
          : "Your information, your choice"
      }
    >
      <section className="mx-auto max-w-2xl">
        <div className="text-center">
          <h1 className="font-serif text-4xl font-bold sm:text-5xl">
            {t("consent.title")}
          </h1>
          <p className="mt-3 text-ink/70">
            {language === "hi"
              ? "आपके जवाब डॉक्टर को आपकी बात समझने में मदद करेंगे।"
              : "Your answers help prepare your information for the doctor."}
          </p>
        </div>
        <ul className="mt-8 space-y-3">
          <ConsentCard
            icon="1"
            title={
              language === "hi" ? "अपनी बात बताएं" : "Share your health story"
            }
          >
            {language === "hi"
              ? "मुलाकात से पहले हम आपकी जानकारी व्यवस्थित करते हैं।"
              : "We collect information before your consultation."}
          </ConsentCard>
          <ConsentCard
            icon="2"
            title={
              language === "hi" ? "आप बदल सकते हैं" : "Review before sending"
            }
          >
            {language === "hi"
              ? "भेजने से पहले अपने जवाब देख और सुधार सकते हैं।"
              : "You can review and correct your answers before sending them."}
          </ConsentCard>
          <ConsentCard
            icon="3"
            title={
              language === "hi"
                ? "डॉक्टर समीक्षा करेंगे"
                : "A doctor reviews it"
            }
          >
            {language === "hi"
              ? "HELIOS डॉक्टर की जगह नहीं लेता।"
              : "HELIOS helps prepare information; it does not replace your doctor."}
          </ConsentCard>
          <ConsentCard
            icon="4"
            title={
              language === "hi"
                ? "जो पता है वही बताएं"
                : "It’s okay not to know"
            }
          >
            {language === "hi"
              ? "किसी बात का पता न हो तो ऐसा बताएं।"
              : "Share what you know. It is okay to say you are not sure."}
          </ConsentCard>
        </ul>
        <label className="mt-6 flex min-h-14 cursor-pointer items-center gap-4 rounded-2xl border border-ink/10 bg-white p-4 font-semibold">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            className="h-6 w-6 accent-teal"
          />
          <span>{t("consent.accept")}</span>
        </label>
        <div className="mt-5 space-y-4">
          {error && (
            <ErrorState message={error} onRetry={() => void continueFlow()} />
          )}
          <PrimaryCTA
            disabled={!accepted}
            loading={busy}
            onClick={() => void continueFlow()}
          >
            {busy
              ? language === "hi"
                ? "आपकी पसंद सहेजी जा रही है…"
                : "Saving your choice…"
              : language === "hi"
                ? t("common.continue")
                : "I Understand & Continue"}
          </PrimaryCTA>
        </div>
      </section>
    </PatientShell>
  );
}
