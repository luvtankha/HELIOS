"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { languageRegistry, type LanguageCode } from "@helios/shared";
import { ErrorState } from "@/components/patient/feedback";
import { LanguageCard, PrimaryCTA } from "@/components/patient/controls";
import { PatientShell } from "@/components/patient/patient-shell";
import { useSessionGuard } from "@/hooks/use-session-guard";
import { useTranslation } from "@/i18n/use-translation";
import { stepRoutes } from "@/providers/patient-flow-provider";

export default function LanguagePage() {
  const router = useRouter();
  const flow = useSessionGuard();
  const { t } = useTranslation();
  const [selected, setSelected] = useState<LanguageCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function continueFlow() {
    setBusy(true);
    setError("");
    try {
      const currentStep = flow.state.currentStep;
      await flow.chooseLanguage(selected ?? flow.state.language);
      router.push(
        currentStep === "LANGUAGE"
          ? "/patient/consent"
          : stepRoutes[currentStep],
      );
    } catch {
      setError("Your language could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!flow.state.hydrated)
    return (
      <PatientShell>
        <div
          className="mx-auto h-40 max-w-2xl animate-pulse rounded-3xl bg-white"
          aria-busy="true"
          aria-label="Preparing language choices"
        />
      </PatientShell>
    );

  return (
    <PatientShell backHref="/patient" eyebrow="Your language · आपकी भाषा">
      <section className="mx-auto max-w-2xl text-center">
        <h1 className="font-serif text-4xl font-bold sm:text-5xl">
          {t("patient.language.title")}
        </h1>
        <p className="mt-3 text-lg text-ink/60">
          {t("patient.language.subtitle")}
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {languageRegistry
            .filter((profile) => profile.code === "en" || profile.code === "hi")
            .map((profile) => {
              return (
                <LanguageCard
                  key={profile.code}
                  code={profile.nativeName.slice(0, 2)}
                  language={profile.nativeName}
                  nativeName={profile.name}
                  selected={(selected ?? flow.state.language) === profile.code}
                  onSelect={() => setSelected(profile.code as LanguageCode)}
                />
              );
            })}
        </div>
        <div className="mt-7 space-y-4">
          {error && (
            <ErrorState message={error} onRetry={() => void continueFlow()} />
          )}
          <PrimaryCTA loading={busy} onClick={() => void continueFlow()}>
            {busy ? `${t("success.saved")}…` : t("common.continue")}
          </PrimaryCTA>
        </div>
      </section>
    </PatientShell>
  );
}
