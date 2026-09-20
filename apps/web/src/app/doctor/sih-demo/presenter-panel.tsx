"use client";

import type { DoctorQueueItemDto } from "@helios/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useDoctorAuth } from "@/providers/doctor-auth-provider";
import { doctorDashboardApi } from "@/services/doctor-dashboard";

const steps = [
  [
    "1. Patient intake",
    "Choose Hindi, consent, enter synthetic details, and use text if speech is unavailable.",
    "/patient/language",
  ],
  [
    "2. Review and submit",
    "Use the real review screen; submission creates the backend token.",
    "/patient/review",
  ],
  [
    "3. Waiting and call",
    "Keep the patient waiting page open in another browser context; call from the real queue.",
    "/doctor/queue",
  ],
  [
    "4. What Changed",
    "Compare Aarav’s two seeded visits using the Phase 8 comparison engine.",
    "/doctor/what-changed",
  ],
  [
    "5. Verification",
    "Inspect source evidence and confirm one fact with the real doctor action.",
    "/doctor/verification",
  ],
] as const;

export function PresenterPanel() {
  const { session } = useDoctorAuth();
  const [golden, setGolden] = useState<DoctorQueueItemDto>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState<"READY" | "FAILED" | null>(
    null,
  );

  async function resetDemo() {
    if (!session || resetting) return;
    setConfirmReset(false);
    setResetting(true);
    setResetResult(null);
    try {
      const result = await doctorDashboardApi.resetDemo(session.doctorToken);
      if (result.state !== "READY") throw new Error("Reset validation failed");
      localStorage.setItem("helios.demo.reset.v1", result.resetId);
      setResetResult("READY");
      const query = new URLSearchParams({
        search: "DEMO-AARAV-024",
        page: "1",
        limit: "30",
      });
      try {
        const dashboard = await doctorDashboardApi.dashboard(
          query,
          session.doctorToken,
        );
        setGolden(
          dashboard.queue.find((item) => item.patientCode === "DEMO-AARAV-024"),
        );
        setError(false);
      } catch {
        setError(true);
      }
    } catch {
      setResetResult("FAILED");
    } finally {
      setResetting(false);
    }
  }

  useEffect(() => {
    if (!session) return;
    let active = true;
    const query = new URLSearchParams({
      search: "DEMO-AARAV-024",
      page: "1",
      limit: "30",
    });
    doctorDashboardApi
      .dashboard(query, session.doctorToken)
      .then((result) => {
        if (active) {
          setGolden(
            result.queue.find((item) => item.patientCode === "DEMO-AARAV-024"),
          );
          setError(false);
        }
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session]);

  return (
    <main className="p-5 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-teal-900">
          SIH demo mode · presenter guide
        </span>
        <h1 className="mt-5 font-serif text-4xl font-bold text-[#102a43]">
          One connected HELIOS story
        </h1>
        <p className="mt-3 max-w-3xl leading-7 text-slate-700">
          Use the real patient and doctor screens. These links navigate; they
          never advance clinical state, bypass consent, or create a token.
        </p>
        <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          Demonstration data — synthetic patient. SafetyEngine is unavailable;
          do not present a queue priority badge as a rule-derived safety signal.
        </p>
        <section
          aria-label="Golden showcase patient"
          className="mt-7 rounded-2xl border border-slate-200 bg-white p-5"
        >
          <h2 className="font-serif text-2xl font-bold">Golden patient</h2>
          {loading ? (
            <p className="mt-2 text-sm text-slate-600">
              Checking the live doctor queue…
            </p>
          ) : error ? (
            <p role="alert" className="mt-2 text-sm text-red-800">
              Patient records could not be loaded. Check the API and database.
            </p>
          ) : golden ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-slate-700">
                <strong>{golden.fullName}</strong> · {golden.patientCode} ·
                Token {golden.tokenNumber ?? "not assigned"}
              </p>
              <Link
                className="rounded-xl bg-[#0b6f69] px-4 py-3 text-sm font-bold text-white"
                href={`/doctor/patients/${golden.patientId}?visitId=${golden.visitId}`}
              >
                Open live patient workspace
              </Link>
            </div>
          ) : (
            <p role="alert" className="mt-2 text-sm text-amber-900">
              Golden patient is not in the authorized doctor view. Reset the
              dedicated synthetic demo database before presenting.
            </p>
          )}
        </section>
        <section
          aria-label="Demonstration navigation"
          className="mt-7 grid gap-4 md:grid-cols-2"
        >
          {steps.map(([title, description, href]) => (
            <article
              key={title}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <h2 className="font-serif text-xl font-bold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {description}
              </p>
              <Link
                href={href}
                className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-teal-800 underline underline-offset-4"
              >
                Open real screen →
              </Link>
            </article>
          ))}
        </section>
        <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-serif text-xl font-bold">
            Reset for the next judge
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Restore the isolated synthetic SIH dataset, documents, queue and
            token state. Your presenter sign-in stays active.
          </p>
          {resetting ? (
            <p
              role="status"
              className="mt-3 text-sm font-semibold text-teal-800"
            >
              Resetting demo records, restoring fixtures and validating the
              result…
            </p>
          ) : null}
          {resetResult === "READY" ? (
            <div
              role="status"
              className="mt-3 rounded-xl bg-teal-50 p-4 text-sm text-teal-900"
            >
              <p className="font-bold">
                Demo reset successfully. The synthetic baseline is validated;
                clinical SafetyEngine rules remain unavailable.
              </p>
              <div className="mt-3 flex gap-4">
                <Link className="underline" href="/patient/language">
                  Start patient demo
                </Link>
                <Link className="underline" href="/doctor/queue">
                  Open doctor dashboard
                </Link>
              </div>
            </div>
          ) : null}
          {resetResult === "FAILED" ? (
            <p role="alert" className="mt-3 text-sm text-red-800">
              Reset failed or could not be verified. Use{" "}
              <code>pnpm demo:reset</code> on the presenter machine, then check
              the demo state before presenting.
            </p>
          ) : null}
          {!confirmReset ? (
            <button
              type="button"
              disabled={resetting || !session}
              onClick={() => setConfirmReset(true)}
              className="mt-4 rounded-xl bg-teal-800 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              Reset Demo
            </button>
          ) : (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-950">
                Reset demo? This restores the complete synthetic SIH
                demonstration to its starting state.
              </p>
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void resetDemo()}
                  className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-bold text-white"
                >
                  Confirm Reset Demo
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
