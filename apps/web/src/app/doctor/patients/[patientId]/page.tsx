"use client";

import type {
  DoctorNoteDto,
  DoctorPatientWorkspaceDto,
  MedicalDocumentDto,
} from "@helios/shared";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useDoctorAuth } from "@/providers/doctor-auth-provider";
import { doctorDashboardApi } from "@/services/doctor-dashboard";
import { verificationApi } from "@/services/verification";

const tabs = [
  "Clinical Brief",
  "What Changed",
  "Safety",
  "Documents & Evidence",
  "Timeline",
  "AI Insights",
  "Verification History",
  "Notes",
] as const;
type Tab = (typeof tabs)[number];

export default function DoctorPatientWorkspacePage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <DoctorPatientWorkspaceContent />
    </Suspense>
  );
}

function DoctorPatientWorkspaceContent() {
  const { patientId } = useParams<{ patientId: string }>();
  const visitId = useSearchParams().get("visitId") ?? undefined;
  const { session } = useDoctorAuth();
  const [workspace, setWorkspace] = useState<DoctorPatientWorkspaceDto>();
  const [tab, setTab] = useState<Tab>("Clinical Brief");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const requestId = useRef(0);
  const load = useCallback(async () => {
    const request = ++requestId.current;
    if (!session) {
      setWorkspace(undefined);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    setWorkspace(undefined);
    try {
      const value = await doctorDashboardApi.workspace(
        patientId,
        session.doctorToken,
        visitId,
      );
      if (request === requestId.current) setWorkspace(value);
    } catch {
      if (request === requestId.current)
        setError("Patient information could not be loaded.");
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, [patientId, session, visitId]);
  useEffect(() => {
    void load();
    return () => {
      requestId.current += 1;
    };
  }, [load]);
  async function transition(
    status: "IN_PROGRESS" | "UNDER_REVIEW" | "VERIFIED" | "COMPLETED",
  ) {
    if (!session || !workspace) return;
    setWorking(true);
    setError("");
    try {
      await doctorDashboardApi.transitionVisit(
        workspace.visit.id,
        status,
        session.doctorToken,
      );
      await load();
    } catch {
      setError("Visit status could not be updated. Please try again.");
    } finally {
      setWorking(false);
    }
  }
  if (loading) return <WorkspaceSkeleton />;
  if (error && !workspace)
    return (
      <main className="p-6 lg:p-8">
        <div
          role="alert"
          className="mx-auto max-w-4xl rounded-2xl border border-red-200 bg-red-50 p-6"
        >
          <h1 className="text-xl font-bold text-red-900">
            Patient workspace unavailable
          </h1>
          <p className="mt-2 text-red-800">{error}</p>
          <button
            onClick={() => void load()}
            className="mt-4 rounded-xl bg-red-800 px-4 py-2 font-bold text-white"
          >
            Try again
          </button>
        </div>
      </main>
    );
  if (!workspace) return null;
  return (
    <main className="p-5 lg:p-8">
      <div className="mx-auto max-w-[1500px]">
        <Link href="/doctor" className="text-sm font-bold text-teal-700">
          ← Back to today’s queue
        </Link>
        <section className="mt-4 rounded-3xl bg-[#102b46] p-5 text-white lg:flex lg:items-end lg:justify-between lg:p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-200">
              Patient workspace · {workspace.patient.patientCode}
            </p>
            <h1 className="mt-2 font-serif text-3xl font-bold sm:text-4xl">
              {workspace.patient.fullName}
            </h1>
            <p className="mt-2 text-sm text-white/70">
              {workspace.patient.age} years ·{" "}
              {workspace.patient.sex.replaceAll("_", " ").toLowerCase()} ·{" "}
              {workspace.patient.preferredLanguage.toUpperCase()} · Token{" "}
              {workspace.visit.tokenNumber ?? "—"}
            </p>
            <p className="mt-3 max-w-3xl text-white/90">
              {workspace.visit.chiefComplaint ?? "No chief complaint recorded."}
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 lg:mt-0">
            <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-bold">
              {workspace.visit.status.replaceAll("_", " ")}
            </span>
            {nextActions(workspace.visit.status).map((action) => (
              <button
                disabled={working}
                key={action.status}
                onClick={() => void transition(action.status)}
                className="rounded-xl bg-teal-300 px-4 py-2 text-sm font-black text-[#102f52] disabled:opacity-50"
              >
                {action.label}
              </button>
            ))}
          </div>
        </section>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/doctor/verification"
            className="inline-flex min-h-11 items-center rounded-xl border border-teal-700 bg-white px-4 text-sm font-bold text-teal-800"
          >
            Open Verification Center · verify / correct / reject / uncertain
          </Link>
          <Link
            href={`/doctor/patients/${patientId}/ayush`}
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold"
          >
            AYUSH review
          </Link>
        </div>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800"
          >
            {error}
          </p>
        )}
        <div className="mt-6 overflow-x-auto border-b border-slate-200">
          <div
            role="tablist"
            aria-label="Patient clinical views"
            className="flex min-w-max gap-1"
          >
            {tabs.map((item) => (
              <button
                key={item}
                role="tab"
                aria-selected={tab === item}
                onClick={() => setTab(item)}
                aria-controls="patient-clinical-panel"
                className={`min-h-12 border-b-2 px-4 text-sm font-bold ${tab === item ? "border-teal-600 text-teal-800" : "border-transparent text-slate-500"}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <section role="tabpanel" id="patient-clinical-panel" className="mt-6">
          <TabContent
            tab={tab}
            workspace={workspace}
            onNotesChange={(notes) => setWorkspace({ ...workspace, notes })}
            token={session?.doctorToken ?? ""}
          />
        </section>
      </div>
    </main>
  );
}

function TabContent({
  tab,
  workspace,
  onNotesChange,
  token,
}: {
  tab: Tab;
  workspace: DoctorPatientWorkspaceDto;
  onNotesChange(notes: DoctorNoteDto[]): void;
  token: string;
}) {
  if (tab === "Clinical Brief")
    return workspace.clinicalBrief ? (
      <div className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 xl:col-span-2">
          <div className="flex flex-wrap justify-between gap-2">
            <h2 className="text-xl font-bold">Clinical brief</h2>
            <Tag>
              {workspace.clinicalBrief.status} · v
              {workspace.clinicalBrief.version}
            </Tag>
          </div>
          <p className="mt-4 whitespace-pre-line leading-7 text-slate-700">
            {workspace.clinicalBrief.narrative}
          </p>
        </article>
        {workspace.clinicalBrief.sections.map((section) => (
          <article
            key={section.sectionType}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <h3 className="font-bold">{section.title}</h3>
            {section.claims.length ? (
              <ul className="mt-3 space-y-3">
                {section.claims.map((claim) => (
                  <li key={claim.id} className="rounded-xl bg-slate-50 p-3">
                    <p>{claim.text}</p>
                    <p className="mt-2 text-xs font-bold text-slate-500">
                      {claim.sourceType.replaceAll("_", " ")} ·{" "}
                      {claim.verificationStatus.replaceAll("_", " ")}
                      {claim.needsVerification ? " · NEEDS VERIFICATION" : ""}
                    </p>
                    {claim.evidence.length > 0 && (
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer font-bold text-teal-700">
                          {claim.evidence.length} evidence reference(s)
                        </summary>
                        <ul className="mt-2 space-y-1">
                          {claim.evidence.map((evidence, index) => (
                            <li key={`${evidence.sourceId}-${index}`}>
                              {evidence.label}
                              {evidence.pageNumber
                                ? ` · page ${evidence.pageNumber}`
                                : ""}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty
                text={
                  section.availability === "UNAVAILABLE"
                    ? "This source is not available."
                    : "Nothing recorded in this section."
                }
              />
            )}
          </article>
        ))}
      </div>
    ) : (
      <EmptyPanel
        title="Clinical brief is not available"
        text="The record does not yet contain enough source information to generate a brief."
      />
    );
  if (tab === "What Changed")
    return workspace.comparison ? (
      <div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="New" value={workspace.comparison.summary.newCount} />
          <Metric
            label="Changed"
            value={workspace.comparison.summary.changedCount}
          />
          <Metric
            label="Conflicts"
            value={workspace.comparison.summary.conflictCount}
          />
          <Metric
            label="Needs review"
            value={workspace.comparison.summary.needsReviewCount}
          />
        </div>
        <div className="mt-4 space-y-3">
          {workspace.comparison.changes
            .filter((change) => change.changeType !== "UNCHANGED")
            .map((change) => (
              <article
                key={change.id}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div className="flex justify-between gap-3">
                  <h3 className="font-bold">
                    {change.entityType.replaceAll("_", " ")}
                  </h3>
                  <Tag>{change.changeType}</Tag>
                </div>
                <div className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-2">
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                      Previous
                    </span>
                    <span className="mt-1 block break-words font-semibold">
                      {change.previousValue == null
                        ? "Not recorded"
                        : display(change.previousValue)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                      Current
                    </span>
                    <span className="mt-1 block break-words font-semibold">
                      {change.currentValue == null
                        ? "Not recorded"
                        : display(change.currentValue)}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {change.explanation}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {change.previousSource?.replaceAll("_", " ") ??
                    "Previous source unavailable"}{" "}
                  →{" "}
                  {change.currentSource?.replaceAll("_", " ") ??
                    "Current source unavailable"}
                </p>
                {change.needsReview && (
                  <p className="mt-3 text-xs font-black text-amber-800">
                    REQUIRES CLINICAL REVIEW
                  </p>
                )}
              </article>
            ))}
        </div>
      </div>
    ) : (
      <EmptyPanel
        title="No comparison yet"
        text="At least two visits are required before HELIOS can show what changed."
      />
    );
  if (tab === "Safety")
    return (
      <div className="space-y-4">
        <Disclaimer />
        {workspace.safetySignals.length ? (
          workspace.safetySignals.map((signal) => (
            <article
              key={signal.id}
              className={`rounded-2xl border-l-4 bg-white p-5 shadow-sm ${signal.severity === "HIGH" ? "border-rose-600" : "border-amber-500"}`}
            >
              <div className="flex flex-wrap justify-between gap-2">
                <h2 className="font-bold">{signal.title}</h2>
                <Tag>{signal.severity}</Tag>
              </div>
              <p className="mt-2 text-slate-700">{signal.description}</p>
              <p
                className={`mt-3 text-sm font-bold ${signal.severity === "HIGH" ? "text-rose-800" : "text-amber-800"}`}
              >
                {signal.reviewMessage}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Stored source: {signal.source} · {signal.status}
              </p>
            </article>
          ))
        ) : (
          <EmptyPanel
            title="No stored safety signals"
            text="HELIOS does not infer that this patient is risk-free. The SafetyEngine is not available in this build."
          />
        )}
      </div>
    );
  if (tab === "Documents & Evidence")
    return workspace.documents.length ? (
      <div className="grid gap-4 lg:grid-cols-2">
        {workspace.documents.map((document) => (
          <article
            key={document.id}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <div className="flex justify-between gap-3">
              <h2 className="font-bold">{document.fileName}</h2>
              <Tag>{document.processingStatus}</Tag>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {document.summary ?? "No document summary available."}
            </p>
            <p className="mt-3 text-xs font-bold text-slate-500">
              {document.documentType.replaceAll("_", " ")} ·{" "}
              {document.pageCount} page(s) · identity{" "}
              {document.identityStatus.replaceAll("_", " ")}
            </p>
            <DocumentPreviewButton document={document} token={token} />
            {document.facts.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-bold text-teal-700">
                  Review {document.facts.length} extracted fact(s)
                </summary>
                <ul className="mt-3 space-y-2">
                  {document.facts.map((fact) => (
                    <li
                      key={fact.id}
                      className="rounded-lg bg-slate-50 p-3 text-sm"
                    >
                      <strong>{fact.factType.replaceAll("_", " ")}</strong>
                      <p className="mt-1 break-words text-slate-600">
                        {display(fact.normalizedValue ?? fact.originalValue)}
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        DOCUMENT EXTRACTED · {fact.confidenceBand} CONFIDENCE ·{" "}
                        {fact.status}
                      </p>
                      {fact.evidence.map((evidence) => (
                        <blockquote
                          key={evidence.id}
                          className="mt-2 border-l-2 border-teal-400 pl-3 text-xs text-slate-600"
                        >
                          Page {evidence.pageNumber}: {evidence.sourceText}
                        </blockquote>
                      ))}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </article>
        ))}
      </div>
    ) : (
      <EmptyPanel
        title="No documents"
        text="No medical documents are attached to this patient."
      />
    );
  if (tab === "Timeline")
    return workspace.timeline.length ? (
      <div className="space-y-3">
        {workspace.timeline.map((event) => (
          <article
            key={event.id}
            className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-[150px_1fr_auto]"
          >
            <time className="text-sm font-bold text-slate-500">
              {new Date(
                event.eventDate ?? event.recordedAt,
              ).toLocaleDateString()}
            </time>
            <div>
              <h2 className="font-bold">{event.title}</h2>
              {event.description && (
                <p className="mt-1 text-sm text-slate-600">
                  {event.description}
                </p>
              )}
              <p className="mt-2 text-xs font-bold text-slate-500">
                {event.sourceLabel} ·{" "}
                {event.verificationStatus.replaceAll("_", " ")}
              </p>
            </div>
            {event.hasConflict && <Tag>CONFLICT</Tag>}
          </article>
        ))}
      </div>
    ) : (
      <EmptyPanel
        title="Timeline is empty"
        text="No projected clinical events are available."
      />
    );
  if (tab === "AI Insights")
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Disclaimer />
        <Metric
          label="Structured facts"
          value={workspace.aiInsights.structuredFactCount}
        />
        <Metric
          label="Pending verification"
          value={workspace.aiInsights.pendingVerificationCount}
        />
        <ListPanel
          title="Missing information"
          items={workspace.aiInsights.missingInformation}
          empty="No missing fields were recorded by the interview workflow."
        />
        <ListPanel
          title="Contradictions"
          items={workspace.aiInsights.contradictions}
          empty="No interview contradictions were recorded."
        />
      </div>
    );
  if (tab === "Verification History")
    return workspace.verificationHistory.length ? (
      <div className="space-y-3">
        {workspace.verificationHistory.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <div className="flex flex-wrap justify-between gap-2">
              <h2 className="font-bold">{item.action.replaceAll("_", " ")}</h2>
              <time className="text-sm text-slate-500">
                {new Date(item.verifiedAt).toLocaleString()}
              </time>
            </div>
            <p className="mt-2 text-sm">
              {item.previousStatus.replaceAll("_", " ")} →{" "}
              {item.newStatus.replaceAll("_", " ")}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Reviewed by {item.doctorName} · fact version {item.factVersion}
            </p>
            {item.reason && (
              <p className="mt-2 text-sm text-slate-600">
                Reason: {item.reason}
              </p>
            )}
          </article>
        ))}
      </div>
    ) : (
      <EmptyPanel
        title="No verification history"
        text="No doctor verification decisions have been recorded for this patient."
      />
    );
  return (
    <NotesPanel workspace={workspace} token={token} onChange={onNotesChange} />
  );
}

function DocumentPreviewButton({
  document,
  token,
}: {
  document: MedicalDocumentDto;
  token: string;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true);
    setError("");
    try {
      setUrl(await verificationApi.documentContent(document.id, token));
    } catch {
      setError("Document could not be opened. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  function close() {
    URL.revokeObjectURL(url);
    setUrl("");
  }
  return (
    <>
      <button
        onClick={() => void open()}
        disabled={busy}
        className="mt-3 min-h-10 rounded-lg border border-teal-700 px-3 text-xs font-bold text-teal-800 disabled:opacity-50"
      >
        {busy ? "Opening…" : "View original document"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      )}
      {url && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Original document: ${document.fileName}`}
          className="fixed inset-0 z-50 bg-slate-950/80 p-4"
        >
          <div className="mx-auto flex h-full max-w-6xl flex-col rounded-2xl bg-white p-4">
            <div className="flex items-center justify-between gap-3 pb-3">
              <h2 className="truncate font-bold">{document.fileName}</h2>
              <button
                onClick={close}
                className="rounded-lg border px-3 py-2 font-bold"
              >
                Close
              </button>
            </div>
            <iframe
              title={document.fileName}
              src={url}
              className="min-h-0 flex-1 border"
            />
          </div>
        </div>
      )}
    </>
  );
}

function NotesPanel({
  workspace,
  token,
  onChange,
}: {
  workspace: DoctorPatientWorkspaceDto;
  token: string;
  onChange(notes: DoctorNoteDto[]): void;
}) {
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!content.trim()) return;
    setBusy(true);
    setError("");
    try {
      const note = await doctorDashboardApi.createNote(
        workspace.patient.id,
        content,
        workspace.visit.id,
        token,
      );
      onChange([note, ...workspace.notes]);
      setContent("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Note could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <div className="space-y-3">
        {workspace.notes.length ? (
          workspace.notes.map((note) => (
            <DoctorNoteCard
              key={note.id}
              note={note}
              token={token}
              onSaved={(updated) =>
                onChange(
                  workspace.notes.map((current) =>
                    current.id === updated.id ? updated : current,
                  ),
                )
              }
            />
          ))
        ) : (
          <EmptyPanel
            title="No doctor notes"
            text="Add the first consultation note for this visit."
          />
        )}
      </div>
      <form
        onSubmit={submit}
        className="h-fit rounded-2xl border border-slate-200 bg-white p-5 lg:sticky lg:top-5"
      >
        <h2 className="font-bold">Add consultation note</h2>
        <label className="mt-4 block text-sm font-bold">
          Clinical note
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            maxLength={4000}
            required
            className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal"
            placeholder="Record observations and consultation context…"
          />
        </label>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          disabled={busy || !content.trim()}
          className="mt-4 min-h-11 w-full rounded-xl bg-[#0b6f69] px-4 font-bold text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save note"}
        </button>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          The original patient-submitted record is preserved. This note is
          attributed and audited.
        </p>
      </form>
    </div>
  );
}

function DoctorNoteCard({
  note,
  token,
  onSaved,
}: {
  note: DoctorNoteDto;
  token: string;
  onSaved(note: DoctorNoteDto): void;
}) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(note.content);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      onSaved(
        await doctorDashboardApi.updateNote(
          note.patientId,
          note.id,
          content,
          token,
        ),
      );
      setEditing(false);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Note could not be updated.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
      {editing ? (
        <form onSubmit={save}>
          <label className="block text-sm font-bold">
            Edit clinical note
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={5}
              maxLength={4000}
              required
              className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal"
            />
          </label>
          {error && (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              disabled={busy || !content.trim()}
              className="rounded-lg bg-[#0b6f69] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setContent(note.content);
              }}
              className="rounded-lg border px-4 py-2 text-sm font-bold"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="whitespace-pre-wrap leading-6">{note.content}</p>
          <p className="mt-3 text-xs font-bold text-slate-500">
            {note.author.displayName} ·{" "}
            {new Date(note.createdAt).toLocaleString()}
            {note.updatedAt !== note.createdAt ? " · edited" : ""}
          </p>
          {note.editable && (
            <button
              onClick={() => setEditing(true)}
              className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold"
            >
              Edit note
            </button>
          )}
        </>
      )}
    </article>
  );
}

function nextActions(status: string) {
  if (status === "WAITING")
    return [{ label: "Start consultation", status: "IN_PROGRESS" as const }];
  if (status === "READY_FOR_DOCTOR")
    return [
      { label: "Start consultation", status: "IN_PROGRESS" as const },
      { label: "Begin review", status: "UNDER_REVIEW" as const },
    ];
  if (status === "IN_PROGRESS")
    return [
      { label: "Send to review", status: "UNDER_REVIEW" as const },
      { label: "Complete", status: "COMPLETED" as const },
    ];
  if (status === "UNDER_REVIEW")
    return [
      { label: "Approve intake", status: "VERIFIED" as const },
      { label: "Complete", status: "COMPLETED" as const },
    ];
  if (status === "VERIFIED")
    return [{ label: "Complete consultation", status: "COMPLETED" as const }];
  return [];
}
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="h-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
      {children}
    </span>
  );
}
function Metric({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </article>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="mt-3 text-sm text-slate-500">{text}</p>;
}
function EmptyPanel({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <h2 className="font-bold">{title}</h2>
      <p className="mt-2 text-sm text-slate-500">{text}</p>
    </div>
  );
}
function Disclaimer() {
  return (
    <aside className="rounded-2xl border border-blue-200 bg-blue-50 p-5 md:col-span-2">
      <p className="font-bold text-blue-900">
        Clinical decision support, not a diagnosis
      </p>
      <p className="mt-1 text-sm leading-6 text-blue-800">
        AI-structured information and stored safety signals require clinician
        verification. Absence of a signal does not establish absence of risk.
      </p>
    </aside>
  );
}
function ListPanel({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-bold">{title}</h2>
      {items.length ? (
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <Empty text={empty} />
      )}
    </article>
  );
}
function WorkspaceSkeleton() {
  return (
    <main
      className="p-6 lg:p-8"
      aria-busy="true"
      aria-label="Loading patient workspace"
    >
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div className="h-44 animate-pulse rounded-3xl bg-slate-200" />
        <div className="h-14 animate-pulse rounded-xl bg-slate-200" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-72 animate-pulse rounded-2xl bg-slate-200" />
        </div>
      </div>
    </main>
  );
}
function display(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value);
}
