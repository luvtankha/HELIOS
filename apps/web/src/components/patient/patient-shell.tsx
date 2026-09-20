"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslation } from "@/i18n/use-translation";
import { publicConfig } from "@/lib/config";
import { BrandMark } from "@/components/ui/brand-mark";

const progressSteps = [
  "Basic information",
  "Chief complaint",
  "Health history",
  "Previous records",
  "Review",
] as const;

interface PatientShellProps {
  children: ReactNode;
  activeStep?: number | undefined;
  backHref?: string | undefined;
  eyebrow?: string | undefined;
}

export function PatientShell({
  children,
  activeStep,
  backHref,
  eyebrow,
}: PatientShellProps) {
  const { language, direction } = useTranslation();
  return (
    <main
      lang={language}
      dir={direction}
      className="min-h-screen bg-[#f6f8f7] text-ink"
    >
      <PatientHeader backHref={backHref} />
      <div className="mx-auto w-full max-w-5xl px-4 pb-14 sm:px-6 lg:px-8">
        {activeStep !== undefined && (
          <ProgressIndicator activeStep={activeStep} />
        )}
        {eyebrow && (
          <p className="mb-3 text-center text-xs font-bold uppercase tracking-[0.22em] text-teal">
            {eyebrow}
          </p>
        )}
        {children}
      </div>
    </main>
  );
}

export function PatientHeader({
  backHref,
}: Readonly<{ backHref?: string | undefined }>) {
  const { language, t } = useTranslation();
  return (
    <header className="mx-auto flex min-h-20 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
      <div className="w-24">
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-ink/70 hover:bg-white"
          >
            <span aria-hidden="true">←</span> {t("common.back")}
          </Link>
        )}
      </div>
      <Link
        href="/"
        aria-label="HELIOS home"
        className="flex items-center gap-2 rounded-xl px-2 py-2"
      >
        <BrandMark />
        <strong className="text-lg font-extrabold tracking-[0.12em]">
          HELIOS
        </strong>
        {publicConfig.demoMode && (
          <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black tracking-wider text-amber-900">
            DEMO MODE
          </span>
        )}
      </Link>
      <div className="w-24 text-right sm:w-28">
        <Link
          href="/patient/language"
          aria-label={t("accessibility.changeLanguage")}
          className="inline-flex min-h-11 items-center rounded-full bg-white px-3 py-2 text-xs font-bold text-ink/65"
        >
          {language === "hi" ? "हिन्दी" : "English"}
        </Link>
      </div>
    </header>
  );
}

export function ProgressIndicator({
  activeStep,
}: Readonly<{ activeStep: number }>) {
  const { language } = useTranslation();
  const labels =
    language === "hi"
      ? [
          "मूल जानकारी",
          "मुख्य परेशानी",
          "स्वास्थ्य इतिहास",
          "पिछले रिकॉर्ड",
          "समीक्षा",
        ]
      : progressSteps;
  return (
    <nav className="mb-8 pt-2" aria-label="Your progress">
      <p className="mb-3 text-center text-sm font-bold text-ink/70">
        {language === "hi" ? "आपकी स्वास्थ्य कहानी" : "Your health story"}
        <span className="ml-2 font-normal text-ink/55">
          {Math.min(activeStep + 1, labels.length)} / {labels.length}
        </span>
      </p>
      <ol className="mx-auto flex max-w-3xl items-start justify-between gap-1">
        {labels.map((label, index) => {
          const complete = index < activeStep;
          const active = index === activeStep;
          return (
            <li
              key={label}
              className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center"
            >
              <span
                className={`h-2 w-full rounded-full ${complete || active ? "bg-ocean" : "bg-ink/10"}`}
              />
              <span
                className={`hidden text-[11px] leading-tight sm:block ${active ? "font-bold text-ink" : "text-ink/45"}`}
              >
                {label}
              </span>
              <span className="sr-only">
                {label}
                {complete ? ", complete" : active ? ", current" : ""}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
