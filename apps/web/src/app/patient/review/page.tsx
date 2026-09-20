"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PrimaryCTA } from "@/components/patient/controls";
import { ErrorState, ReviewCard } from "@/components/patient/feedback";
import { PatientShell } from "@/components/patient/patient-shell";
import { useSessionGuard } from "@/hooks/use-session-guard";
import { SpecializationRoutingCard } from "@/components/patient/specialization-routing-card";

export default function ReviewPage() {
  const router = useRouter();
  const flow = useSessionGuard();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    try {
      await flow.submit();
      router.push("/patient/complete");
    } catch {
      setError("Your information could not be sent. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PatientShell
      activeStep={4}
      backHref="/patient/interview"
      eyebrow="Nothing is sent until you choose"
    >
      <section className="mx-auto max-w-3xl">
        <div className="text-center">
          <h1 className="font-serif text-4xl sm:text-5xl">
            Review your information
          </h1>
          <p className="mt-3 text-lg text-ink/60">
            You can edit anything before sending it to your doctor.
          </p>
        </div>
        <div className="mt-8 space-y-4">
          <ReviewCard
            icon="◉"
            title="Basic information"
            onEdit={() => router.push("/patient/details")}
            summary={
              <>
                {flow.state.details.fullName || "Not provided"}
                {flow.state.details.age && `, ${flow.state.details.age} years`}
                {flow.state.details.sex &&
                  ` · ${humanize(flow.state.details.sex)}`}
              </>
            }
          />
          <SpecializationRoutingCard sessionToken={flow.state.sessionToken} />
          <ReviewCard
            icon="✦"
            title="Chief complaint"
            onEdit={() => router.push("/patient/complaint")}
            summary={<q>{flow.state.complaint || "Not provided"}</q>}
          />
          <ReviewCard
            icon="＋"
            title="Health details"
            onEdit={() => router.push("/patient/interview")}
            summary={
              <>
                {flow.state.answers.location || "Location not provided"} ·{" "}
                {flow.state.answers.duration || "Duration not provided"} ·
                Symptoms: {flow.state.answers.associatedSymptoms || "Not provided"}
              </>
            }
          />
          <ReviewCard
            icon="▤"
            title="Documents"
            onEdit={() => router.push("/patient/documents")}
            summary="Add a previous prescription, report, discharge summary or consultation note (optional)."
          />
        </div>
        <div className="mt-6 rounded-2xl bg-teal/10 p-4 text-center text-sm font-semibold text-ink/70">
          Your information will be reviewed by a doctor.
        </div>
        <div className="mt-5 space-y-4">
          {error && (
            <ErrorState message={error} onRetry={() => void submit()} />
          )}
          <PrimaryCTA
            loading={busy}
            disabled={!flow.state.complaint || !flow.state.patientId}
            onClick={() => void submit()}
          >
            {busy ? "Sharing your health story…" : "Submit for consultation"}
          </PrimaryCTA>
        </div>
      </section>
    </PatientShell>
  );
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}
