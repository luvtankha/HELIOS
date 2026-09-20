"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { PatientShell } from "@/components/patient/patient-shell";
import { SuccessActions, TokenCard } from "@/components/patient/feedback";
import { useSessionGuard } from "@/hooks/use-session-guard";

export default function CompletePage() {
  const router = useRouter();
  const flow = useSessionGuard();
  return (
    <PatientShell eyebrow="Ready for your consultation">
      <section className="mx-auto max-w-2xl text-center">
        <span
          className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-teal text-4xl text-white shadow-soft"
          aria-hidden="true"
        >
          ✓
        </span>
        <h1 className="mt-7 font-serif text-4xl sm:text-5xl">
          Your health story has been shared.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-ink/60">
          Your information is now ready for clinical review. You can wait for
          your consultation.
        </p>
        <div className="mx-auto mt-8 max-w-md">
          <TokenCard
            token={flow.state.tokenNumber ?? "Pending"}
            submittedAt={flow.state.submittedAt}
          />
        </div>
        <section className="mx-auto mt-7 max-w-xl rounded-3xl border border-ink/8 bg-white p-6 text-left">
          <h2 className="font-bold">What happens next?</h2>
          <ol className="mt-3 space-y-2 text-sm leading-6 text-ink/60">
            <li>1. The clinic sees that your information is ready.</li>
            <li>2. A doctor reviews what you shared.</li>
            <li>
              3. The doctor speaks with you and verifies the clinical record.
            </li>
          </ol>
        </section>
        <div className="mx-auto mt-7 max-w-md">
          <Link
            href="/patient/waiting"
            className="mb-3 flex min-h-14 w-full items-center justify-between rounded-2xl bg-teal px-6 font-bold text-white"
          >
            View live waiting status <span aria-hidden="true">→</span>
          </Link>
          <Link
            href="/patient/timeline"
            className="mb-3 flex min-h-14 w-full items-center justify-between rounded-2xl bg-ocean px-6 font-bold text-white"
          >
            View your health timeline <span aria-hidden="true">→</span>
          </Link>
          <SuccessActions
            onDone={() => {
              flow.reset();
              router.push("/");
            }}
            onSummary={() => router.push("/patient/review")}
          />
        </div>
        <p className="mt-5 text-xs text-ink/45">
          HELIOS does not provide medical recommendations on this screen.
        </p>
      </section>
    </PatientShell>
  );
}
