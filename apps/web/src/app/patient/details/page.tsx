"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  AnswerOption,
  LargeInput,
  PrimaryCTA,
} from "@/components/patient/controls";
import { ErrorState } from "@/components/patient/feedback";
import { PatientShell } from "@/components/patient/patient-shell";
import { useSessionGuard } from "@/hooks/use-session-guard";
import type { PatientFormDetails } from "@/types/patient-flow";

type Errors = Partial<Record<keyof PatientFormDetails, string>>;

export default function DetailsPage() {
  const router = useRouter();
  const flow = useSessionGuard();
  const [form, setForm] = useState(flow.state.details);
  const dirty = useRef(false);
  useEffect(() => {
    if (flow.state.hydrated && !dirty.current) setForm(flow.state.details);
  }, [flow.state.hydrated, flow.state.details]);
  const updateForm = (next: PatientFormDetails) => {
    dirty.current = true;
    setForm(next);
  };
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function validate() {
    const next: Errors = {};
    if (!/^[\p{L}][\p{L}\p{M} .'-]{1,99}$/u.test(form.fullName.trim()))
      next.fullName = "Please enter a valid name.";
    const age = Number(form.age);
    if (!form.age) next.age = "Please enter your age.";
    else if (!Number.isInteger(age) || age < 0 || age > 120)
      next.age = "Please enter a valid age.";
    if (!form.sex) next.sex = "Please choose the option that fits you.";
    if (form.phone && !/^\+?[0-9 ]{8,15}$/.test(form.phone))
      next.phone = "Please enter a valid phone number.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function continueFlow() {
    if (!validate()) return;
    setBusy(true);
    setError("");
    flow.setDetails(form);
    try {
      await flow.saveDetails(form);
      router.push("/patient/complaint");
    } catch {
      setError("Your details could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PatientShell
      activeStep={0}
      backHref="/patient/consent"
      eyebrow="Just the essentials"
    >
      <section className="mx-auto max-w-2xl">
        <div className="text-center">
          <h1 className="font-serif text-4xl sm:text-5xl">
            Tell us a few details
          </h1>
          <p className="mt-3 text-ink/60">
            This helps your doctor identify your information.
          </p>
        </div>
        <div className="mt-8 space-y-6 rounded-[2rem] border border-white bg-white/75 p-5 shadow-soft sm:p-8">
          <LargeInput
            label="Full name"
            name="fullName"
            autoComplete="name"
            value={form.fullName}
            error={errors.fullName}
            placeholder="Your full name"
            onChange={(event) =>
              updateForm({ ...form, fullName: event.target.value })
            }
          />
          <LargeInput
            label="Age"
            name="age"
            inputMode="numeric"
            value={form.age}
            error={errors.age}
            placeholder="Your age"
            onChange={(event) =>
              updateForm({ ...form, age: event.target.value })
            }
          />
          <fieldset>
            <legend className="mb-3 text-sm font-bold">Gender</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["MALE", "Male"],
                  ["FEMALE", "Female"],
                  ["OTHER", "Other"],
                  ["PREFER_NOT_TO_SAY", "Prefer not to say"],
                ] as const
              ).map(([value, label]) => (
                <AnswerOption
                  key={value}
                  selected={form.sex === value}
                  onClick={() => updateForm({ ...form, sex: value })}
                >
                  {label}
                </AnswerOption>
              ))}
            </div>
            {errors.sex && (
              <p role="alert" className="mt-2 text-sm text-red-700">
                {errors.sex}
              </p>
            )}
          </fieldset>
          <LargeInput
            label="Phone number (optional)"
            name="phone"
            inputMode="tel"
            autoComplete="tel"
            value={form.phone}
            error={errors.phone}
            hint="Only if you want the clinic to use it for this visit."
            placeholder="e.g. +91 98765 43210"
            onChange={(event) =>
              updateForm({ ...form, phone: event.target.value })
            }
          />
        </div>
        <div className="mt-5 space-y-4">
          {error && (
            <ErrorState message={error} onRetry={() => void continueFlow()} />
          )}
          <PrimaryCTA loading={busy} onClick={() => void continueFlow()}>
            {busy ? "Saving your information…" : "Continue"}
          </PrimaryCTA>
        </div>
      </section>
    </PatientShell>
  );
}
