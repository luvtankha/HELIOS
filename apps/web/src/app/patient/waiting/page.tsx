"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PatientQueueStatusDto } from "@helios/shared";
import { PatientShell } from "@/components/patient/patient-shell";
import { useSessionGuard } from "@/hooks/use-session-guard";
import { patientQueueApi } from "@/services/queue";

export default function PatientWaitingPage() {
  const flow = useSessionGuard();
  const token = flow.state.sessionToken;
  const [status, setStatus] = useState<PatientQueueStatusDto>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!token) return;
    let active = true;
    async function refresh() {
      try {
        const next = await patientQueueApi.status(token!);
        if (active) {
          setStatus(next);
          setError("");
        }
      } catch {
        if (active)
          setError("Waiting status is unavailable. We’ll try again shortly.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 8_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [token]);
  const called = status?.status === "CALLED";
  return (
    <PatientShell eyebrow="Your place in the queue">
      <main className="mx-auto max-w-xl py-5 text-center">
        <h1 className="font-serif text-3xl font-bold sm:text-4xl">
          {called
            ? "Your turn"
            : status?.status === "IN_CONSULTATION"
              ? "Your consultation has started"
              : status?.status === "COMPLETED"
                ? "Consultation complete"
                : "You’re checked in"}
        </h1>
        <p className="mt-3 text-slate-600">
          {called
            ? "Please proceed to the consultation area."
            : "We’ll update this screen as the queue moves."}
        </p>
        {called && (
          <p
            className="mx-auto mt-5 w-fit rounded-full bg-teal-100 px-5 py-2 font-bold text-teal-900 motion-safe:animate-pulse"
            role="status"
          >
            Please proceed to the consultation area
          </p>
        )}
        {loading && !status ? (
          <div
            aria-busy="true"
            className="mt-8 h-80 animate-pulse rounded-3xl bg-white"
          />
        ) : status ? (
          <section
            aria-live="polite"
            className="mt-8 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm"
          >
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
              Your token
            </p>
            <p className="mt-3 break-words text-7xl font-black tracking-tight text-[#0b2748] sm:text-8xl">
              {status.tokenNumber}
            </p>
            <p
              className={`mx-auto mt-5 w-fit rounded-full px-4 py-2 text-sm font-black ${called ? "bg-teal-100 text-teal-900" : "bg-blue-50 text-blue-900"}`}
            >
              {status.status.replaceAll("_", " ")}
            </p>
            <div className="mt-7 grid grid-cols-2 gap-3 text-left">
              <Info
                label="Currently serving"
                value={status.currentToken ?? "—"}
              />
              <Info
                label="Patients ahead"
                value={String(status.patientsAhead)}
              />
              <Info label="Estimated wait" value={status.estimateLabel} />
              <Info
                label="Queue"
                value={status.queuePaused ? "Paused" : "Moving"}
              />
            </div>
            <p className="mt-5 text-xs text-slate-500">
              Wait time is an estimate, not a guaranteed appointment time.
              Updates approximately every {status.refreshAfterSeconds} seconds.
            </p>
          </section>
        ) : (
          <div className="mt-8 rounded-2xl bg-amber-50 p-6 text-amber-900">
            No checked-in token is available yet.
          </div>
        )}
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </p>
        )}
        <Link
          href="/patient/complete"
          className="mt-7 inline-flex min-h-12 items-center rounded-xl border border-slate-300 bg-white px-5 font-bold"
        >
          Back to completion
        </Link>
      </main>
    </PatientShell>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-black text-[#0b2748]">{value}</p>
    </div>
  );
}
