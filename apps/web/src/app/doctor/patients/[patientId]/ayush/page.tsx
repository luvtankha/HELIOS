"use client";

import type {
  AyushPatientViewDto,
  AyushRecordDto,
} from "@helios/shared";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ayushApi } from "@/services/ayush";
import {
  DoctorLanguageControl,
  doctorText,
  useDoctorLanguage,
} from "@/components/doctor/doctor-language-control";
import { useDoctorAuth } from "@/providers/doctor-auth-provider";

export default function AyushCasePage() {
  const { patientId } = useParams<{ patientId: string }>();
  const { session } = useDoctorAuth();
  const [view, setView] = useState<AyushPatientViewDto>();
  const [status, setStatus] = useState<"ALL" | AyushRecordDto["useStatus"]>(
    "ALL",
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const doctorLanguage = useDoctorLanguage(session?.doctorToken);

  useEffect(() => {
    if (!session) return;
    void ayushApi
      .doctorView(patientId, session.doctorToken)
      .then(setView)
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "AYUSH information is unavailable.",
        ),
      )
      .finally(() => setLoading(false));
  }, [patientId, session]);

  const records = useMemo(
    () =>
      view?.records.filter(
        (record) => status === "ALL" || record.useStatus === status,
      ) ?? [],
    [status, view],
  );

  // DoctorShell owns the session gate and does not render protected children
  // until a doctor session is hydrated.
  if (!session) return null;

  return (
    <main className="min-h-screen bg-[#f4f7f7]">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <div className="flex flex-col justify-between gap-5 border-b border-ink/10 pb-6 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-ocean">
              Whole-person record
            </p>
            <h1 className="mt-2 font-serif text-4xl sm:text-5xl">
              AYUSH &amp; other healthcare use
            </h1>
            <p className="mt-3 max-w-3xl text-ink/60">
              Patient-reported and documented information, shown neutrally with
              source and verification state. HELIOS does not prescribe,
              diagnose, infer efficacy, or infer causality.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <DoctorLanguageControl
              language={doctorLanguage.language}
              onChange={doctorLanguage.setLanguage}
            />
            <Link
              href={`/doctor/patients/${patientId}/brief`}
              className="rounded-xl border border-ink/15 bg-white px-4 py-2 text-sm font-bold"
            >
              {doctorText(
                doctorLanguage.language,
                "Clinical brief",
                "क्लिनिकल सारांश",
              )}
            </Link>
            <Link
              href="/doctor/verification"
              className="rounded-xl bg-ink px-4 py-2 text-sm font-bold text-white"
            >
              Open Verification Center
            </Link>
          </div>
        </div>

        {loading && (
          <div role="status" className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="h-56 animate-pulse rounded-3xl bg-white" />
            <div className="h-56 animate-pulse rounded-3xl bg-white" />
          </div>
        )}
        {error && (
          <p
            role="alert"
            className="mt-8 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950"
          >
            {error}
          </p>
        )}
        {view && !loading && (
          <>
            <section
              className="mt-7 grid gap-4 md:grid-cols-3"
              aria-label="AYUSH context summary"
            >
              <Metric label="Documented records" value={view.records.length} />
              <Metric
                label="Current reported use"
                value={
                  view.records.filter((item) => item.useStatus === "CURRENT")
                    .length
                }
              />
              <Metric
                label="Needs verification"
                value={
                  view.records.filter(
                    (item) =>
                      !["DOCTOR_VERIFIED", "DOCTOR_CORRECTED"].includes(
                        item.verificationStatus,
                      ),
                  ).length
                }
              />
            </section>

            <section className="mt-6 rounded-3xl border border-ink/10 bg-white p-5">
              <h2 className="font-serif text-2xl">Concurrent healthcare use</h2>
              <p className="mt-2 text-sm text-ink/60">
                {view.concurrentUseIdentified
                  ? "Concurrent conventional medication and AYUSH treatment use is documented."
                  : "Concurrent conventional medication and current AYUSH treatment use is not documented."}
              </p>
              <p className="mt-2 text-sm font-bold text-amber-900">
                {view.interactionInformation === "VALIDATED_SIGNAL_AVAILABLE"
                  ? "An existing Safety Engine signal is available for doctor review."
                  : "Interaction information unavailable. No interaction is inferred."}
              </p>
              {view.conventionalMedications.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {view.conventionalMedications.map((item) => (
                    <span
                      key={item.id}
                      className="rounded-full bg-mist px-3 py-1 text-xs font-bold"
                    >
                      {item.name}
                      {item.dose ? ` · ${item.dose}` : ""}
                    </span>
                  ))}
                </div>
              )}
            </section>

            <div
              className="mt-7 flex flex-wrap gap-2"
              aria-label="Filter by use status"
            >
              {(
                [
                  "ALL",
                  "CURRENT",
                  "HISTORICAL",
                  "STOPPED",
                  "UNKNOWN",
                  "NOT_DOCUMENTED",
                ] as const
              ).map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={status === item}
                  onClick={() => setStatus(item)}
                  className={`rounded-full px-4 py-2 text-sm font-bold ${status === item ? "bg-ocean text-white" : "border border-ink/10 bg-white"}`}
                >
                  {human(item)}
                </button>
              ))}
            </div>

            <section
              className="mt-5 grid gap-5 lg:grid-cols-2"
              aria-label="AYUSH records"
            >
              {records.map((record) => (
                <AyushCard
                  key={record.id}
                  record={record}
                  language={doctorLanguage.language}
                />
              ))}
              {!records.length && (
                <p className="rounded-3xl border border-dashed border-ink/20 bg-white p-8 text-ink/55">
                  No AYUSH information is documented for this view.
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-ink/10 bg-white p-5">
      <p className="text-sm text-ink/50">{label}</p>
      <p className="mt-2 font-serif text-4xl">{value}</p>
    </div>
  );
}

function AyushCard({
  record,
  language,
}: {
  record: AyushRecordDto;
  language: "en" | "hi";
}) {
  return (
    <article className="rounded-3xl border border-ink/10 bg-white p-6 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-ocean">
            {ayushSystem(record.system, language)}
          </p>
          <h2 className="mt-2 font-serif text-2xl">
            {record.normalizedName ?? record.originalName}
          </h2>
        </div>
        <span className="rounded-full bg-mist px-3 py-1 text-xs font-bold">
          {human(record.useStatus)}
        </span>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <Fact label="Source" value={human(record.sourceType)} />
        <Fact label="Verification" value={human(record.verificationStatus)} />
        <Fact label="Dose" value={record.dosage ?? "Not documented"} />
        <Fact label="Frequency" value={record.frequency ?? "Not documented"} />
        <Fact
          label="Started"
          value={record.startDate ? date(record.startDate) : "Not documented"}
        />
        <Fact
          label="Ingredients"
          value={record.ingredients?.join(", ") ?? "Ingredients not documented"}
        />
      </dl>
      {record.reportedEffect && (
        <div className="mt-5 rounded-2xl bg-amber-50 p-4">
          <p className="text-xs font-bold uppercase text-amber-900">
            Temporal information
          </p>
          <p className="mt-1 text-sm">
            {record.reportedEffect} was reported after treatment use. Causality
            is not inferred.
          </p>
        </div>
      )}
      <details className="mt-5 border-t border-ink/10 pt-4">
        <summary className="cursor-pointer text-sm font-bold text-ocean">
          Source and evidence
        </summary>
        <div className="mt-3 space-y-3">
          {record.evidence.map((item, index) => (
            <blockquote
              key={`${item.sourceId}:${index}`}
              className="rounded-xl bg-mist p-3 text-sm"
            >
              <strong>{item.label}</strong>
              {item.sourceText && (
                <p className="mt-1 text-ink/65">{item.sourceText}</p>
              )}
              {item.pageNumber && (
                <p className="mt-1 text-xs text-ink/45">
                  Page {item.pageNumber}
                </p>
              )}
            </blockquote>
          ))}
        </div>
      </details>
    </article>
  );
}
function ayushSystem(value: string, language: "en" | "hi") {
  const hindi: Record<string, string> = {
    AYURVEDA: "आयुर्वेद",
    YOGA_NATUROPATHY: "योग और प्राकृतिक चिकित्सा",
    UNANI: "यूनानी",
    SIDDHA: "सिद्ध",
    HOMOEOPATHY: "होम्योपैथी",
    OTHER_TRADITIONAL_SYSTEM: "अन्य पारंपरिक पद्धति",
    UNKNOWN: "अज्ञात",
  };
  return language === "hi" ? (hindi[value] ?? human(value)) : human(value);
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-ink/40">
        {label}
      </dt>
      <dd className="mt-1 text-ink/75">{value}</dd>
    </div>
  );
}
function human(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}
function date(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}
