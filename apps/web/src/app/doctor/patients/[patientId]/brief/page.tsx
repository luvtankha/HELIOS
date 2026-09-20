"use client";

import type {
  BriefClaimDto,
  BriefSectionDto,
  ClinicalBriefDto,
} from "@helios/shared";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { clinicalBriefApi } from "@/services/clinical-brief";
import {
  DoctorLanguageControl,
  doctorText,
  useDoctorLanguage,
} from "@/components/doctor/doctor-language-control";
import { useDoctorAuth } from "@/providers/doctor-auth-provider";

export default function ClinicalBriefPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const { session } = useDoctorAuth();
  const [brief, setBrief] = useState<ClinicalBriefDto>();
  const [selected, setSelected] = useState<BriefClaimDto>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const doctorLanguage = useDoctorLanguage(session?.doctorToken);
  useEffect(() => {
    if (!session || !patientId) return;
    setLoading(true);
    clinicalBriefApi
      .quick(patientId, session.doctorToken)
      .then(setBrief)
      .catch(showError)
      .finally(() => setLoading(false));
  }, [patientId, session]);
  function showError(reason: unknown) {
    void reason;
    setError("Clinical brief could not be loaded. Please try again.");
  }
  async function refresh() {
    if (!brief || !session) return;
    setLoading(true);
    setError("");
    try {
      setBrief(await clinicalBriefApi.refresh(brief.id, session.doctorToken));
    } catch (reason) {
      showError(reason);
    } finally {
      setLoading(false);
    }
  }
  async function review() {
    if (!brief || !session) return;
    try {
      setBrief(await clinicalBriefApi.review(brief.id, session.doctorToken));
    } catch (reason) {
      showError(reason);
    }
  }
  // DoctorShell owns the session gate and does not render protected children
  // until a doctor session is hydrated.
  if (!session) return null;
  return (
    <main className="min-h-screen bg-[#f4f7f7]">
      {loading && (
        <div
          className="mx-auto max-w-6xl px-6 py-16"
          aria-label="Loading clinical brief"
        >
          <div className="h-40 animate-pulse rounded-3xl bg-white" />
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div className="h-64 animate-pulse rounded-3xl bg-white" />
            <div className="h-64 animate-pulse rounded-3xl bg-white" />
          </div>
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="mx-auto mt-8 max-w-5xl rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950"
        >
          {error}
        </div>
      )}
      {brief && !loading && (
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
          <header className="border-b border-ink/10 pb-6">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.2em] text-ocean">
                  HELIOS clinical brief
                </p>
                <h1 className="mt-2 font-serif text-4xl sm:text-5xl">
                  {brief.patientName}
                </h1>
                <p className="mt-2 text-ink/60">
                  {brief.age} years · {human(brief.sex)} ·{" "}
                  {brief.preferredLanguage.toUpperCase()} · {brief.patientCode}
                </p>
                <p className="mt-1 text-sm text-ink/50">
                  Current visit · {formatDate(brief.visitDate)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <DoctorLanguageControl
                  language={doctorLanguage.language}
                  onChange={doctorLanguage.setLanguage}
                />
                <Status value={brief.status} />
                <button
                  onClick={() => void refresh()}
                  className="rounded-xl border border-ink/15 bg-white px-4 py-2 text-sm font-bold"
                >
                  {doctorText(
                    doctorLanguage.language,
                    "Refresh brief",
                    "सारांश रीफ़्रेश करें",
                  )}
                </button>
                {brief.status !== "REVIEWED" && (
                  <button
                    onClick={() => void review()}
                    className="rounded-xl bg-ink px-4 py-2 text-sm font-bold text-white"
                  >
                    {doctorText(
                      doctorLanguage.language,
                      "Mark reviewed",
                      "समीक्षित चिह्नित करें",
                    )}
                  </button>
                )}
              </div>
            </div>
            {brief.status === "STALE" && (
              <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
                <strong>
                  Patient information changed after this brief was generated.
                </strong>{" "}
                Refresh before relying on the summary.
              </div>
            )}
          </header>
          <p className="mt-5 max-w-4xl text-sm leading-6 text-ink/55">
            Structured, source-linked information for rapid review. HELIOS does
            not diagnose, recommend treatment, or interpret clinical
            significance.
          </p>
          <div className="mt-7 grid gap-5 lg:grid-cols-2">
            {brief.sections
              .filter(
                (section) =>
                  !["PATIENT_SNAPSHOT", "SOURCE_EVIDENCE"].includes(
                    section.sectionType,
                  ),
              )
              .map((section) => (
                <BriefSection
                  key={section.sectionType}
                  section={section}
                  onEvidence={setSelected}
                />
              ))}
          </div>
          <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 py-6 text-xs text-ink/50">
            <span>
              Version {brief.version} · {brief.generatorVersion} ·{" "}
              {brief.claimCount} traceable claims
            </span>
            <div className="flex gap-4">
              <Link
                className="font-bold text-ocean underline"
                href={`/doctor/patients/${brief.patientId}/ayush`}
              >
                AYUSH record
              </Link>
              <Link
                className="font-bold text-ocean underline"
                href="/doctor/what-changed"
              >
                Review changes
              </Link>
              <button
                className="font-bold text-ocean underline"
                onClick={() =>
                  setSelected(
                    brief.sections.flatMap((section) => section.claims)[0],
                  )
                }
              >
                Review sources
              </button>
            </div>
          </footer>
        </div>
      )}
      {selected && (
        <EvidenceDrawer
          claim={selected}
          onClose={() => setSelected(undefined)}
        />
      )}
    </main>
  );
}

function BriefSection({
  section,
  onEvidence,
}: {
  section: BriefSectionDto;
  onEvidence: (claim: BriefClaimDto) => void;
}) {
  const safety =
    section.sectionType === "SAFETY_ATTENTION" &&
    section.claims.some((claim) => claim.sourceType === "RISK_SIGNAL");
  const body =
    section.availability !== "AVAILABLE" && section.claims.length === 0 ? (
      <p className="text-sm text-ink/50">
        {section.availability === "UNAVAILABLE"
          ? unavailable(section.sectionType)
          : "No information documented for this section."}
      </p>
    ) : (
      <ul className="space-y-3">
        {section.claims.map((claim) => (
          <li
            key={claim.id}
            className="rounded-xl border border-ink/10 bg-white p-4"
          >
            <p className="leading-6">{claim.text}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-mist px-2 py-1 text-[11px] font-bold text-ink/60">
                {source(claim.sourceType)}
              </span>
              <span className="text-[11px] text-ink/45">
                {human(claim.verificationStatus)}
              </span>
              {claim.needsVerification && (
                <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-900">
                  Needs verification
                </span>
              )}
              <button
                onClick={() => onEvidence(claim)}
                className="ml-auto text-xs font-bold text-ocean underline"
              >
                Evidence
              </button>
            </div>
          </li>
        ))}
      </ul>
    );
  const classes = `rounded-2xl border p-5 ${safety ? "border-red-300 bg-red-50" : section.sectionType === "NEEDS_VERIFICATION" ? "border-amber-200 bg-amber-50/60" : "border-ink/10 bg-white"}`;
  if (section.collapsible)
    return (
      <details className={classes} open={section.defaultExpanded}>
        <summary className="cursor-pointer list-none font-serif text-2xl">
          {section.title}
          <span className="float-right text-sm text-ink/35">
            {section.claims.length}
          </span>
        </summary>
        <div className="mt-4">{body}</div>
      </details>
    );
  return (
    <section className={classes}>
      <h2 className="font-serif text-2xl">{section.title}</h2>
      <div className="mt-4">{body}</div>
    </section>
  );
}
function EvidenceDrawer({
  claim,
  onClose,
}: {
  claim: BriefClaimDto;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-ink/35"
      role="dialog"
      aria-modal="true"
      aria-label="Claim evidence"
    >
      <button
        aria-label="Close evidence"
        className="absolute inset-0"
        onClick={onClose}
      />
      <aside className="absolute right-0 top-0 h-full w-full max-w-lg overflow-y-auto bg-white p-7 shadow-2xl">
        <div className="flex justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-ocean">
              Traceable claim
            </p>
            <h2 className="mt-2 font-serif text-2xl">{claim.text}</h2>
          </div>
          <button
            aria-label="Close"
            className="h-10 w-10 shrink-0 rounded-full bg-mist text-xl"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="mt-6 space-y-4">
          {claim.evidence.map((evidence, index) => (
            <article
              key={`${evidence.kind}:${evidence.sourceId}:${index}`}
              className="rounded-2xl bg-mist p-4"
            >
              <p className="font-bold">{evidence.label}</p>
              <p className="mt-1 text-xs text-ink/50">
                {human(evidence.kind)}
                {evidence.eventDate
                  ? ` · ${formatDate(evidence.eventDate)}`
                  : ""}
                {evidence.pageNumber ? ` · Page ${evidence.pageNumber}` : ""}
              </p>
              {evidence.sourceText && (
                <blockquote className="mt-3 border-l-2 border-ocean pl-3 text-sm leading-6 text-ink/65">
                  {evidence.sourceText}
                </blockquote>
              )}
              <p className="mt-3 break-all text-[10px] text-ink/35">
                Source ID: {evidence.sourceId}
              </p>
            </article>
          ))}
        </div>
        <pre className="mt-6 overflow-x-auto whitespace-pre-wrap rounded-2xl bg-ink p-4 text-xs text-white">
          {JSON.stringify(claim.structuredValue, null, 2)}
        </pre>
        <p className="mt-4 text-xs leading-5 text-ink/50">
          Confidence and provenance describe capture quality, not medical
          certainty.
        </p>
      </aside>
    </div>
  );
}
function Status({ value }: { value: ClinicalBriefDto["status"] }) {
  return (
    <span
      className={`rounded-full px-4 py-2 text-xs font-bold ${value === "STALE" ? "bg-amber-100 text-amber-900" : value === "REVIEWED" ? "bg-emerald-100 text-emerald-900" : "bg-ocean/10 text-ocean"}`}
    >
      {human(value)}
    </span>
  );
}
function unavailable(section: BriefSectionDto["sectionType"]) {
  return section === "WHAT_CHANGED"
    ? "Change comparison unavailable."
    : section === "SAFETY_ATTENTION"
      ? "Safety attention status unavailable."
      : "Information unavailable.";
}
function source(value: string) {
  return value === "COMPARISON" ? "What changed" : human(value);
}
function human(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}
