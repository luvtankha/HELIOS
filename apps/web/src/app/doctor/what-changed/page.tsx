"use client";

import type {
  ChangeRecordDto,
  ComparisonChangeType,
  ComparisonDto,
} from "@helios/shared";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useDoctorAuth } from "@/providers/doctor-auth-provider";
import { comparisonApi, type DoctorPatient } from "@/services/comparisons";

const labels: Record<ComparisonChangeType, string> = {
  NEW: "New",
  REMOVED: "Not reported now",
  CHANGED: "Changed",
  UNCHANGED: "Unchanged",
  CONFLICTED: "Needs review",
  UNKNOWN: "Unknown",
  NOT_COMPARABLE: "Not comparable",
  NEWLY_CAPTURED: "Newly captured",
};
const primaryTypes: ComparisonChangeType[] = [
  "CHANGED",
  "NEWLY_CAPTURED",
  "NEW",
  "REMOVED",
  "CONFLICTED",
  "UNKNOWN",
  "NOT_COMPARABLE",
];

export default function WhatChangedPage() {
  const { session, signOut } = useDoctorAuth();
  const [patients, setPatients] = useState<DoctorPatient[]>([]);
  const [patientId, setPatientId] = useState("");
  const [previousVisitId, setPreviousVisitId] = useState("");
  const [currentVisitId, setCurrentVisitId] = useState("");
  const [comparison, setComparison] = useState<ComparisonDto>();
  const [filter, setFilter] = useState<ComparisonChangeType | "ALL">("ALL");
  const [selected, setSelected] = useState<ChangeRecordDto>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) return;
    comparisonApi
      .patients(session.doctorToken)
      .then((items) => {
        setPatients(items);
        const demo =
          items.find((item) => item.id === "demo-patient-aarav") ?? items[0];
        if (demo) choosePatient(demo);
      })
      .catch(showError);
  }, [session]);

  const patient = patients.find((item) => item.id === patientId);
  const visible = useMemo(
    () =>
      comparison?.changes.filter((change) =>
        filter === "ALL"
          ? change.changeType !== "UNCHANGED"
          : change.changeType === filter,
      ) ?? [],
    [comparison, filter],
  );

  function choosePatient(item: DoctorPatient) {
    setPatientId(item.id);
    setComparison(undefined);
    setSelected(undefined);
    setCurrentVisitId(item.visits[0]?.id ?? "");
    setPreviousVisitId(item.visits[1]?.id ?? "");
  }
  function showError(reason: unknown) {
    void reason;
    setError("Comparison information could not be loaded. Please try again.");
  }
  async function compare() {
    if (!session || !patientId || !previousVisitId || !currentVisitId) return;
    setLoading(true);
    setError("");
    try {
      setComparison(
        await comparisonApi.create(
          patientId,
          previousVisitId,
          currentVisitId,
          session.doctorToken,
        ),
      );
      setFilter("ALL");
    } catch (reason) {
      showError(reason);
    } finally {
      setLoading(false);
    }
  }
  // DoctorShell owns the session gate and performs the redirect after sign-out.
  if (!session) return null;

  return (
    <main className="min-h-screen bg-mist">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-ocean">
                Clinical review workspace
              </p>
              <h1 className="mt-2 font-serif text-4xl sm:text-5xl">
                What changed?
              </h1>
              <p className="mt-2 max-w-2xl text-ink/60">
                A source-aware comparison of two recorded visits. HELIOS
                describes differences; it does not infer diagnosis, progression,
                or risk.
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="rounded-full bg-white px-4 py-2 shadow-soft">
                {session.displayName}
              </span>
              <button
                className="font-bold text-ocean underline"
                onClick={signOut}
              >
                Sign out
              </button>
            </div>
          </header>

          <section className="mt-8 grid gap-4 rounded-3xl bg-white p-5 shadow-soft sm:grid-cols-[1.3fr_1fr_1fr_auto] sm:items-end">
            <Field label="Patient">
              <select
                value={patientId}
                onChange={(event) => {
                  const item = patients.find(
                    (candidate) => candidate.id === event.target.value,
                  );
                  if (item) choosePatient(item);
                }}
                className="select-field"
              >
                {patients.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.fullName} · {item.patientCode}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Previous visit">
              <select
                value={previousVisitId}
                onChange={(event) => setPreviousVisitId(event.target.value)}
                className="select-field"
              >
                {patient?.visits.map((visit) => (
                  <option key={visit.id} value={visit.id}>
                    {visitLabel(visit)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Current visit">
              <select
                value={currentVisitId}
                onChange={(event) => setCurrentVisitId(event.target.value)}
                className="select-field"
              >
                {patient?.visits.map((visit) => (
                  <option key={visit.id} value={visit.id}>
                    {visitLabel(visit)}
                  </option>
                ))}
              </select>
            </Field>
            <button
              disabled={loading || !previousVisitId || !currentVisitId}
              onClick={() => void compare()}
              className="min-h-12 rounded-xl bg-ink px-6 font-bold text-white disabled:opacity-50"
            >
              {loading ? "Comparing…" : "Compare visits"}
            </button>
          </section>
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
            >
              {error}
            </p>
          )}

          {!comparison ? (
            <EmptyState />
          ) : (
            <>
              {comparison.status === "STALE" && (
                <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4">
                  <strong>Source records changed.</strong> Generate a new
                  comparison to review the latest information.
                </div>
              )}
              <section className="mt-6 grid gap-3 sm:grid-cols-4">
                <Metric
                  label="Changed"
                  value={comparison.summary.changedCount}
                  tone="ocean"
                />
                <Metric
                  label="Newly captured"
                  value={comparison.summary.newlyCapturedCount}
                  tone="teal"
                />
                <Metric
                  label="Needs review"
                  value={comparison.summary.needsReviewCount}
                  tone="amber"
                />
                <Metric
                  label="Not reported now"
                  value={comparison.summary.removedCount}
                  tone="slate"
                />
              </section>
              <section className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
                <aside className="h-fit rounded-3xl bg-white p-5 shadow-soft">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink/45">
                    Show
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 lg:flex-col">
                    {(["ALL", ...primaryTypes, "UNCHANGED"] as const).map(
                      (type) => (
                        <button
                          key={type}
                          onClick={() => setFilter(type)}
                          className={`flex justify-between rounded-xl px-3 py-2 text-left text-sm font-bold ${filter === type ? "bg-ink text-white" : "bg-mist text-ink"}`}
                        >
                          <span>
                            {type === "ALL" ? "Key changes" : labels[type]}
                          </span>
                          {type !== "ALL" && (
                            <span>
                              {
                                comparison.changes.filter(
                                  (change) => change.changeType === type,
                                ).length
                              }
                            </span>
                          )}
                        </button>
                      ),
                    )}
                  </div>
                  <p className="mt-5 border-t border-ink/10 pt-4 text-xs leading-5 text-ink/50">
                    Engine {comparison.engineVersion}
                    <br />
                    Generated {new Date(comparison.createdAt).toLocaleString()}
                  </p>
                </aside>
                <div>
                  <div className="mb-4">
                    <h2 className="font-serif text-3xl">{patient?.fullName}</h2>
                    <p className="text-sm text-ink/55">
                      {formatDate(comparison.previousVisitDate)} →{" "}
                      {formatDate(comparison.currentVisitDate)}
                    </p>
                  </div>
                  {visible.length ? (
                    <div className="space-y-4">
                      {visible.map((change) => (
                        <ChangeCard
                          key={change.id}
                          change={change}
                          onOpen={() => setSelected(change)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-3xl bg-white p-10 text-center shadow-soft">
                      No records match this filter.
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
          <footer className="mt-12 flex flex-wrap justify-between gap-3 border-t border-ink/10 py-6 text-sm text-ink/50">
            <span>Comparison is descriptive and requires clinical review.</span>
            <div className="flex gap-4">
              <Link
                href="/doctor/verification"
                className="font-bold text-ocean underline"
              >
                Verification Center
              </Link>
              {patientId && (
                <Link
                  href={`/doctor/patients/${patientId}/ayush`}
                  className="font-bold text-ocean underline"
                >
                  AYUSH record
                </Link>
              )}
              {patientId && (
                <Link
                  href={`/doctor/patients/${patientId}/brief`}
                  className="font-bold text-ocean underline"
                >
                  Open clinical brief
                </Link>
              )}
              <Link
                href="/doctor-coming-soon"
                className="font-bold text-ocean underline"
              >
                Other doctor tools
              </Link>
            </div>
          </footer>
        </div>
      {selected && (
        <ChangeDrawer
          change={selected}
          onClose={() => setSelected(undefined)}
        />
      )}
    </main>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-bold text-ink/70">
      <span className="mb-2 block">{label}</span>
      {children}
    </label>
  );
}
function EmptyState() {
  return (
    <section className="mt-8 rounded-[2rem] border border-dashed border-ocean/30 bg-white/60 p-12 text-center">
      <span className="text-4xl" aria-hidden>
        ↔
      </span>
      <h2 className="mt-4 font-serif text-3xl">Choose two visits to begin</h2>
      <p className="mx-auto mt-2 max-w-xl text-ink/55">
        HELIOS matches normalized symptoms, medications, observations,
        documents, and existing safety signals while preserving their sources.
      </p>
    </section>
  );
}
function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  const colors: Record<string, string> = {
    ocean: "border-ocean/20 bg-ocean/5",
    teal: "border-emerald-200 bg-emerald-50",
    amber: "border-amber-200 bg-amber-50",
    slate: "border-slate-200 bg-slate-50",
  };
  return (
    <div className={`rounded-2xl border p-5 ${colors[tone]}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="mt-1 text-sm text-ink/55">{label}</p>
    </div>
  );
}
function ChangeCard({
  change,
  onOpen,
}: {
  change: ChangeRecordDto;
  onOpen: () => void;
}) {
  return (
    <article className="rounded-3xl bg-white p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-ocean/10 px-3 py-1 text-xs font-bold text-ocean">
              {labels[change.changeType]}
            </span>
            {change.needsReview && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                Review
              </span>
            )}
          </div>
          <h3 className="mt-3 font-serif text-2xl capitalize">
            {change.entityKey}
          </h3>
          <p className="mt-1 text-sm leading-6 text-ink/60">
            {change.explanation}
          </p>
        </div>
        <button
          onClick={onOpen}
          className="rounded-xl border border-ink/15 px-4 py-2 text-sm font-bold"
        >
          Details & evidence
        </button>
      </div>
      {change.fieldChanges.length > 0 && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {change.fieldChanges.map((field) => (
            <div key={field.field} className="rounded-2xl bg-mist p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-ink/40">
                {field.field}
              </p>
              <p className="comparison-value mt-2 text-sm">
                <span className="text-ink/45">Before</span>{" "}
                {display(field.previous)}{" "}
                <span className="mx-1 text-ocean">→</span>{" "}
                <span className="text-ink/45">Now</span>{" "}
                {display(field.current)} {field.unit ?? ""}
              </p>
              {field.absoluteDelta !== undefined && (
                <p className="mt-1 text-xs text-ink/50">
                  Recorded difference {signed(field.absoluteDelta)}
                  {field.unit ? ` ${field.unit}` : ""}
                  {field.percentageChange !== undefined
                    ? ` (${signed(field.percentageChange)}%)`
                    : ""}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
function ChangeDrawer({
  change,
  onClose,
}: {
  change: ChangeRecordDto;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-ink/30"
      role="dialog"
      aria-modal="true"
      aria-label="Change evidence"
    >
      <button
        className="absolute inset-0"
        aria-label="Close details"
        onClick={onClose}
      />
      <aside className="absolute right-0 top-0 h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-ocean">
              {labels[change.changeType]}
            </p>
            <h2 className="mt-2 font-serif text-3xl capitalize">
              {change.entityKey}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="h-10 w-10 rounded-full bg-mist text-xl"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <p className="mt-4 leading-7 text-ink/65">{change.explanation}</p>
        <Evidence
          title="Previous evidence"
          evidence={change.previousEvidence}
          value={change.previousValue}
        />
        <Evidence
          title="Current evidence"
          evidence={change.currentEvidence}
          value={change.currentValue}
        />
        {change.relatedRiskSignalId && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="font-bold">Existing safety signal linked</p>
            <p className="text-xs text-ink/55">{change.relatedRiskSignalId}</p>
          </div>
        )}
        <div className="mt-7 rounded-2xl bg-mist p-4 text-xs leading-5 text-ink/55">
          Source records are displayed as captured. This comparison does not
          determine clinical meaning.
        </div>
      </aside>
    </div>
  );
}
function Evidence({
  title,
  evidence,
  value,
}: {
  title: string;
  evidence?: ChangeRecordDto["previousEvidence"];
  value?: unknown;
}) {
  if (!evidence && value === undefined) return null;
  return (
    <section className="mt-6 border-t border-ink/10 pt-5">
      <h3 className="font-bold">{title}</h3>
      {evidence && (
        <div className="mt-3 rounded-2xl bg-mist p-4 text-sm">
          <p>
            <strong>{evidence.source.replaceAll("_", " ")}</strong> ·{" "}
            {evidence.verificationStatus.replaceAll("_", " ")}
          </p>
          {evidence.eventDate && (
            <p className="mt-1 text-ink/50">
              {formatDate(evidence.eventDate)}
              {evidence.pageNumber ? ` · Page ${evidence.pageNumber}` : ""}
            </p>
          )}
          {evidence.sourceText && (
            <blockquote className="mt-3 border-l-2 border-ocean pl-3 text-ink/65">
              {evidence.sourceText}
            </blockquote>
          )}
        </div>
      )}
      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-2xl bg-ink p-4 text-xs text-white">
        {JSON.stringify(value, null, 2)}
      </pre>
    </section>
  );
}
function visitLabel(visit: DoctorPatient["visits"][number]) {
  return `${formatDate(visit.startedAt)} · ${visit.tokenNumber ?? visit.status.replaceAll("_", " ")}`;
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
function display(value: unknown) {
  return value === undefined || value === null
    ? "—"
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
}
function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
}
