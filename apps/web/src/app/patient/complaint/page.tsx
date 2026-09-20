"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PrimaryCTA, SecondaryCTA } from "@/components/patient/controls";
import { ComplaintVoiceConversation } from "@/components/patient/complaint-voice-conversation";
import { PatientShell } from "@/components/patient/patient-shell";
import { useSessionGuard } from "@/hooks/use-session-guard";
import { useTranslation } from "@/i18n/use-translation";

export default function ComplaintPage() {
  const router = useRouter();
  const flow = useSessionGuard();
  const { t } = useTranslation();
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState(flow.state.complaint);

  // This page begins speech automatically, so never construct it from browser
  // storage until the signed session has been verified by the route guard.
  if (!flow.state.hydrated || !flow.sessionReady) {
    return (
      <PatientShell activeStep={1} backHref="/patient/details" eyebrow="In your own words">
        <div className="py-20 text-center" role="status">
          Preparing your secure check-in…
        </div>
      </PatientShell>
    );
  }

  return (
    <PatientShell
      activeStep={1}
      backHref="/patient/details"
      eyebrow="In your own words"
    >
      <section className="mx-auto max-w-3xl text-center">
        {!typing ? (
          <ComplaintVoiceConversation
            language={flow.state.language}
            sessionId={flow.state.sessionId!}
            sessionToken={flow.state.sessionToken!}
            onComplaint={(complaint) => {
              flow.setComplaint(complaint);
              router.push("/patient/interview");
            }}
            onUseText={() => {
              setText(flow.state.complaint);
              setTyping(true);
            }}
          />
        ) : (
          <div className="mx-auto mt-8 max-w-xl text-left">
            <label
              htmlFor="complaint-text"
              className="mb-2 block text-sm font-bold"
            >
              {t("patient.complaint.title")}
            </label>
            <textarea
              id="complaint-text"
              maxLength={4000}
              autoFocus
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={t("patient.complaint.placeholder")}
              className="min-h-44 w-full resize-y rounded-3xl border border-ink/15 bg-white p-5 text-lg leading-8 outline-none focus:border-ocean"
            />
            <p className="mt-2 text-sm text-ink/50">
              You can review and edit this again before submitting.
            </p>
            <div className="mt-5 space-y-3">
              <PrimaryCTA
                disabled={text.trim().length < 2}
                onClick={() => {
                  flow.setComplaint(text.trim());
                  router.push("/patient/interview");
                }}
              >
                {t("common.continue")}
              </PrimaryCTA>
              <SecondaryCTA onClick={() => setTyping(false)}>
                Use microphone instead
              </SecondaryCTA>
            </div>
          </div>
        )}
      </section>
    </PatientShell>
  );
}
