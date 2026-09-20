"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDoctorAuth } from "@/providers/doctor-auth-provider";
import { BrandMark } from "@/components/ui/brand-mark";
import { publicConfig } from "@/lib/config";

export default function DoctorLoginPage() {
  return (
    <Suspense
      fallback={<main className="min-h-screen bg-[#071d36]" aria-busy="true" />}
    >
      <DoctorLoginForm />
    </Suspense>
  );
}

function DoctorLoginForm() {
  const auth = useDoctorAuth();
  const router = useRouter();
  const search = useSearchParams();
  const [username, setUsername] = useState("demo.doctor");
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await auth.signIn(username, accessCode);
      const destination = search.get("returnTo");
      router.replace(
        destination?.startsWith("/doctor") ? destination : "/doctor",
      );
    } catch {
      setError(
        "Sign-in failed. Check your ID and access code, then try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="grid min-h-screen place-items-center bg-[#102b46] p-5">
      <section className="w-full max-w-md rounded-3xl bg-white p-7 shadow-xl sm:p-10">
        <div className="mb-8 flex items-center gap-3">
          <BrandMark />
          <div>
            <p className="font-black tracking-[0.18em] text-[#0b2748]">
              HELIOS
            </p>
            <p className="text-sm text-slate-500">Doctor workspace</p>
          </div>
        </div>
        <h1 className="font-serif text-3xl font-bold text-[#102a43]">
          Sign in to your workspace
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Doctor-only access to patient queues, evidence and clinical review
          tools.
        </p>
        <form onSubmit={submit} className="mt-7 space-y-5">
          <label className="block text-sm font-bold">
            Doctor ID
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              className="helios-field mt-2 w-full font-normal"
            />
          </label>
          <label className="block text-sm font-bold">
            {publicConfig.demoMode ? "Demo access code" : "Access code"}
            <input
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              type="password"
              autoComplete="current-password"
              required
              className="helios-field mt-2 w-full font-normal"
            />
          </label>
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800"
            >
              {error}
            </p>
          )}
          <button disabled={busy} className="helios-button-primary w-full px-5">
            {busy ? "Signing in…" : "Enter doctor workspace"}
          </button>
        </form>
        {publicConfig.demoMode && (
          <p className="mt-6 rounded-xl bg-teal-50 p-3 text-xs leading-5 text-teal-900">
            DEMO MODE · Synthetic records only. Use the access code supplied by
            the demo operator.
          </p>
        )}
      </section>
    </main>
  );
}
