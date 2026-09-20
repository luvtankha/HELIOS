"use client";

import type {
  DoctorSessionDto,
  DocumentEvidenceDto,
  MedicalDocumentDto,
  VerificationAction,
  VerificationFactType,
  VerificationQueueDto,
  VerificationQueueItemDto,
  VerificationReviewDto,
} from "@helios/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EvidenceViewer } from "@/components/documents/evidence-viewer";
import { useDoctorAuth } from "@/providers/doctor-auth-provider";
import { verificationApi } from "@/services/verification";

type UiAction = Exclude<VerificationAction, "SUPERSEDE">;
const filters: Array<{ label: string; value: VerificationFactType | "ALL" }> = [
  { label: "All", value: "ALL" },
  { label: "Documents", value: "DOCUMENT_FACT" },
  { label: "Medications", value: "MEDICATION" },
  { label: "Allergies", value: "ALLERGY" },
  { label: "Symptoms", value: "SYMPTOM" },
  { label: "Observations", value: "OBSERVATION" },
  { label: "Patient reported", value: "INTERVIEW_RESPONSE" },
  { label: "AYUSH", value: "AYUSH_RECORD" },
];

export default function VerificationPage() {
  const { session } = useDoctorAuth();
  const [queue, setQueue] = useState<VerificationQueueDto>();
  const [selected, setSelected] = useState<VerificationReviewDto>();
  const [filter, setFilter] = useState<VerificationFactType | "ALL">("ALL");
  const [conflictsOnly, setConflictsOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError("");
    const query = new URLSearchParams();
    if (filter !== "ALL") query.set("factType", filter);
    if (conflictsOnly) query.set("conflictsOnly", "true");
    if (search.trim()) query.set("search", search.trim());
    try {
      setQueue(
        await verificationApi.queue(session.doctorToken, query.toString()),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Verification queue is unavailable.",
      );
    } finally {
      setLoading(false);
    }
  }, [conflictsOnly, filter, search, session]);

  useEffect(() => {
    void load();
  }, [load]);

  async function open(item: VerificationQueueItemDto) {
    if (!session) return;
    setError("");
    try {
      setSelected(
        await verificationApi.detail(item.reviewId, session.doctorToken),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Review could not be opened.",
      );
    }
  }

  // DoctorShell owns the session gate and does not render protected children
  // until a doctor session is hydrated.
  if (!session) return null;

  return (
    <main className="min-h-screen bg-[#f4f7f7]">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <header className="flex flex-col justify-between gap-5 border-b border-ink/10 pb-7 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-ocean">
              Doctor verification
            </p>
            <h1 className="mt-2 font-serif text-4xl sm:text-5xl">
              Verification Center
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">
              Review source-linked information. Doctor verification confirms a
              recorded fact; it is not a diagnosis or treatment recommendation.
            </p>
          </div>
          <div className="text-sm text-ink/55">
            <strong className="block text-ink">{session.displayName}</strong>
            Authorized doctor session
          </div>
        </header>

        {queue && <Metrics value={queue} />}
        {notice && (
          <p
            role="status"
            className="mt-5 rounded-xl border border-teal/20 bg-teal/10 px-4 py-3 text-sm text-teal"
          >
            {notice}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-ink"
          >
            {error}
          </p>
        )}

        <section
          aria-label="Verification filters"
          className="mt-7 rounded-2xl border border-ink/10 bg-white p-4"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {filters.map((item) => (
                <button
                  key={item.value}
                  onClick={() => setFilter(item.value)}
                  aria-pressed={filter === item.value}
                  className={`rounded-full px-3 py-2 text-xs font-bold ${filter === item.value ? "bg-ink text-white" : "bg-mist text-ink/65"}`}
                >
                  {item.label}
                </button>
              ))}
              <button
                onClick={() => setConflictsOnly((value) => !value)}
                aria-pressed={conflictsOnly}
                className={`rounded-full px-3 py-2 text-xs font-bold ${conflictsOnly ? "bg-amber-200 text-ink" : "bg-mist text-ink/65"}`}
              >
                Conflicts
              </button>
            </div>
            <label className="flex min-w-64 items-center gap-2 rounded-xl border border-ink/15 px-3 py-2 text-sm">
              <span className="sr-only">Search verification queue</span>
              <span aria-hidden="true">⌕</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full bg-transparent outline-none"
                placeholder="Patient, fact, medication…"
              />
            </label>
          </div>
        </section>

        <section aria-label="Verification queue" className="mt-6">
          {loading ? (
            <QueueSkeleton />
          ) : queue?.items.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {queue.items.map((item) => (
                <QueueCard
                  key={item.reviewId}
                  item={item}
                  onReview={() => void open(item)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-ink/20 bg-white p-12 text-center">
              <h2 className="font-serif text-2xl">No matching items</h2>
              <p className="mt-2 text-sm text-ink/55">
                The current queue filters have no unresolved facts.
              </p>
            </div>
          )}
        </section>
      </div>
      {selected && session && (
        <ReviewPanel
          review={selected}
          doctor={session}
          onClose={() => setSelected(undefined)}
          onSaved={(message) => {
            setSelected(undefined);
            setNotice(message);
            void load();
          }}
          onError={setError}
        />
      )}
    </main>
  );
}

function Metrics({ value }: Readonly<{ value: VerificationQueueDto }>) {
  const cards = [
    ["Needs review", value.metrics.needsReview],
    ["Conflicts", value.metrics.conflicts],
    ["Verified today", value.metrics.verifiedToday],
    ["Corrected today", value.metrics.correctedToday],
    ["Rejected today", value.metrics.rejectedToday],
  ] as const;
  return (
    <section
      aria-label="Verification metrics"
      className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-5"
    >
      {cards.map(([label, count]) => (
        <article
          key={label}
          className="rounded-2xl border border-ink/10 bg-white p-4"
        >
          <p className="text-3xl font-bold text-ocean">{count}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink/50">
            {label}
          </p>
        </article>
      ))}
    </section>
  );
}

function QueueCard({
  item,
  onReview,
}: Readonly<{ item: VerificationQueueItemDto; onReview(): void }>) {
  return (
    <article className="rounded-2xl border border-ink/10 bg-white p-5 shadow-[0_12px_35px_rgba(11,39,72,.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-ocean">
            {human(item.factType)}
          </p>
          <h2 className="mt-2 font-serif text-2xl">{item.label}</h2>
        </div>
        <StatusBadge
          status={item.conflict ? "CONFLICT" : item.verificationStatus}
        />
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-ink/65">
        {display(item.value)}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-ink/50">
        <span className="rounded-full bg-mist px-2 py-1 font-bold">
          {human(item.sourceType)}
        </span>
        <span>
          {item.patientName} · {item.patientCode}
        </span>
      </div>
      <button
        onClick={onReview}
        className="mt-5 w-full rounded-xl bg-ink px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-4 focus:ring-ocean/25"
      >
        Review evidence
      </button>
    </article>
  );
}

function ReviewPanel({
  review,
  doctor,
  onClose,
  onSaved,
  onError,
}: Readonly<{
  review: VerificationReviewDto;
  doctor: DoctorSessionDto;
  onClose(): void;
  onSaved(message: string): void;
  onError(message: string): void;
}>) {
  const [action, setAction] = useState<UiAction>();
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const initial = useMemo(() => objectValue(review.value), [review.value]);
  const [corrected, setCorrected] = useState<Record<string, unknown>>(initial);
  const [saving, setSaving] = useState(false);
  const [documentEvidence, setDocumentEvidence] = useState<{
    document: MedicalDocumentDto;
    evidence: DocumentEvidenceDto;
  }>();

  async function openDocument(item: VerificationReviewDto["evidence"][number]) {
    if (!item.documentId) return;
    try {
      const document = await verificationApi.document(
        item.documentId,
        doctor.doctorToken,
      );
      setDocumentEvidence({
        document,
        evidence: {
          id: item.sourceId,
          pageNumber: item.pageNumber ?? 1,
          sourceText: item.sourceText ?? "Source text unavailable",
          ...(validBox(item.boundingBox) && { boundingBox: item.boundingBox }),
        },
      });
    } catch (problem) {
      onError(
        problem instanceof Error
          ? problem.message
          : "Document evidence could not be opened.",
      );
    }
  }

  async function save() {
    if (!action) return;
    setSaving(true);
    try {
      const result = await verificationApi.action(
        review.reviewId,
        action,
        {
          expectedVersion: review.version,
          idempotencyKey: crypto.randomUUID(),
          ...(reason.trim() && { reason: reason.trim() }),
          ...(comment.trim() && { comment: comment.trim() }),
          ...(action === "CORRECT" && { correctedValue: corrected }),
        },
        doctor.doctorToken,
      );
      onSaved(result.message);
    } catch (problem) {
      onError(
        problem instanceof Error
          ? problem.message
          : "Verification could not be saved.",
      );
      setAction(undefined);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/45 p-2 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Verification review"
    >
      <div className="mx-auto grid h-full max-w-6xl overflow-hidden rounded-3xl bg-[#f8fbfa] shadow-2xl lg:grid-cols-[1.45fr_.75fr]">
        <section className="overflow-y-auto p-5 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-ocean">
                Fact requiring verification
              </p>
              <h2 className="mt-2 font-serif text-3xl">{review.label}</h2>
              <p className="mt-2 text-sm text-ink/55">
                {review.patientName} · {review.patientCode}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close review"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-xl"
            >
              ×
            </button>
          </div>
          {review.conflict && review.previous ? (
            <ConflictView
              previous={review.previous.value}
              current={review.value}
              previousStatus={review.previous.verificationStatus}
            />
          ) : (
            <div className="mt-6 rounded-2xl border border-ink/10 bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-ink/45">
                Current record
              </p>
              <p className="mt-2 leading-7">{display(review.value)}</p>
              <div className="mt-3 flex gap-2">
                <StatusBadge status={review.verificationStatus} />
                <span className="rounded-full bg-mist px-2 py-1 text-xs font-bold">
                  {human(review.sourceType)}
                </span>
              </div>
            </div>
          )}
          <h3 className="mt-7 font-serif text-2xl">Evidence</h3>
          <div className="mt-3 space-y-3">
            {review.evidence.map((item) => (
              <article
                key={`${item.kind}:${item.sourceId}`}
                className="rounded-2xl border border-ink/10 bg-white p-4"
              >
                <div className="flex justify-between gap-3">
                  <strong>{item.label}</strong>
                  <span className="text-xs text-ink/45">
                    {human(item.kind)}
                  </span>
                </div>
                {item.sourceText && (
                  <blockquote className="mt-3 border-l-2 border-ocean pl-3 text-sm leading-6 text-ink/65">
                    “{item.sourceText}”
                  </blockquote>
                )}
                {item.language && (
                  <p className="mt-2 text-xs text-ink/45">
                    Original language: {item.language}
                  </p>
                )}
                {item.documentId && (
                  <button
                    onClick={() => void openDocument(item)}
                    className="mt-3 text-xs font-bold text-ocean underline"
                  >
                    Open document page {item.pageNumber ?? "—"}
                  </button>
                )}
              </article>
            ))}
          </div>
          <h3 className="mt-7 font-serif text-2xl">Actions</h3>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {!review.conflict && (
              <ActionButton
                label="Verify"
                onClick={() => setAction("VERIFY")}
              />
            )}
            <ActionButton
              label="Correct"
              onClick={() => setAction("CORRECT")}
            />
            <ActionButton label="Reject" onClick={() => setAction("REJECT")} />
            <ActionButton
              label="Mark uncertain"
              onClick={() => setAction("MARK_UNCERTAIN")}
            />
            {review.conflict && (
              <>
                <ActionButton
                  label="Keep previous"
                  onClick={() => setAction("KEEP_PREVIOUS")}
                />
                <ActionButton
                  label="Confirm current"
                  onClick={() => setAction("CONFIRM_CURRENT")}
                />
              </>
            )}
          </div>
        </section>
        <aside className="overflow-y-auto border-t border-ink/10 bg-white p-5 sm:p-7 lg:border-l lg:border-t-0">
          <p className="text-xs font-bold uppercase tracking-widest text-ocean">
            Verification history
          </p>
          {review.history.length ? (
            <ol className="mt-5 space-y-5">
              {review.history.map((item) => (
                <li key={item.id} className="border-l-2 border-mist pl-4">
                  <strong className="text-sm">{human(item.action)}</strong>
                  <p className="mt-1 text-xs text-ink/55">
                    {item.doctorName} · {formatDate(item.verifiedAt)}
                  </p>
                  {item.reason && (
                    <p className="mt-2 text-sm text-ink/65">{item.reason}</p>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-5 text-sm text-ink/50">
              No doctor action has been recorded yet.
            </p>
          )}
          <p className="mt-8 text-xs leading-5 text-ink/45">
            Source and clinical event dates remain unchanged. Each doctor action
            creates a new immutable history record.
          </p>
        </aside>
      </div>
      {action && (
        <Confirmation
          action={action}
          review={review}
          doctor={doctor.displayName}
          reason={reason}
          comment={comment}
          corrected={corrected}
          saving={saving}
          setReason={setReason}
          setComment={setComment}
          setCorrected={setCorrected}
          onCancel={() => setAction(undefined)}
          onConfirm={() => void save()}
        />
      )}
      {documentEvidence && (
        <EvidenceViewer
          document={documentEvidence.document}
          evidence={documentEvidence.evidence}
          token={doctor.doctorToken}
          contentLoader={verificationApi.documentContent}
          onClose={() => setDocumentEvidence(undefined)}
        />
      )}
    </div>
  );
}

function Confirmation({
  action,
  review,
  doctor,
  reason,
  comment,
  corrected,
  saving,
  setReason,
  setComment,
  setCorrected,
  onCancel,
  onConfirm,
}: Readonly<{
  action: UiAction;
  review: VerificationReviewDto;
  doctor: string;
  reason: string;
  comment: string;
  corrected: Record<string, unknown>;
  saving: boolean;
  setReason(value: string): void;
  setComment(value: string): void;
  setCorrected(value: Record<string, unknown>): void;
  onCancel(): void;
  onConfirm(): void;
}>) {
  const needsReason = [
    "CORRECT",
    "REJECT",
    "KEEP_PREVIOUS",
    "CONFIRM_CURRENT",
  ].includes(action);
  return (
    <div className="absolute inset-0 grid place-items-center bg-ink/55 p-4">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-label={`${human(action)} confirmation`}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-ocean">
          Doctor confirmation
        </p>
        <h3 className="mt-2 font-serif text-3xl">
          {human(action)} this information?
        </h3>
        <dl className="mt-5 grid gap-3 rounded-2xl bg-mist p-4 text-sm">
          <div>
            <dt className="font-bold text-ink/45">Fact</dt>
            <dd>
              {review.label}: {display(review.value)}
            </dd>
          </div>
          <div>
            <dt className="font-bold text-ink/45">Source</dt>
            <dd>{human(review.sourceType)}</dd>
          </div>
          <div>
            <dt className="font-bold text-ink/45">Doctor</dt>
            <dd>{doctor}</dd>
          </div>
        </dl>
        {action === "CORRECT" && (
          <CorrectionEditor
            factType={review.factType}
            value={corrected}
            onChange={setCorrected}
          />
        )}
        <label className="mt-5 block text-sm font-bold">
          Reason {needsReason && <span className="text-coral">(required)</span>}
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-2 min-h-20 w-full rounded-xl border border-ink/15 p-3 font-normal"
          />
        </label>
        <label className="mt-4 block text-sm font-bold">
          Doctor note{" "}
          <span className="font-normal text-ink/45">(internal)</span>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            className="mt-2 min-h-20 w-full rounded-xl border border-ink/15 p-3 font-normal"
          />
        </label>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-xl border border-ink/15 px-4 py-3 font-bold"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={saving || (needsReason && reason.trim().length < 3)}
            className="rounded-xl bg-ink px-5 py-3 font-bold text-white disabled:opacity-40"
          >
            {saving
              ? "Saving…"
              : action === "CORRECT"
                ? "Save correction"
                : `Confirm ${human(action).toLowerCase()}`}
          </button>
        </div>
      </section>
    </div>
  );
}

function CorrectionEditor({
  factType,
  value,
  onChange,
}: Readonly<{
  factType: VerificationFactType;
  value: Record<string, unknown>;
  onChange(value: Record<string, unknown>): void;
}>) {
  const fields = correctionFields[factType];
  return (
    <fieldset className="mt-5 rounded-2xl border border-ink/10 p-4">
      <legend className="px-2 text-sm font-bold">Structured correction</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <label key={field} className="text-xs font-bold text-ink/55">
            {human(field)}
            <input
              value={scalar(value[field])}
              onChange={(event) =>
                onChange({ ...value, [field]: event.target.value })
              }
              className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2 text-sm font-normal text-ink"
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const correctionFields: Record<VerificationFactType, string[]> = {
  CLINICAL_HISTORY: ["chiefComplaint", "severity", "additionalNotes"],
  SYMPTOM: ["name", "severity", "status"],
  MEDICATION: ["name", "dose", "frequency", "route"],
  ALLERGY: ["allergen", "reaction", "severity"],
  OBSERVATION: ["display", "value", "unit"],
  DOCUMENT_FACT: ["name", "value", "unit"],
  INTERVIEW_RESPONSE: ["value"],
  AYUSH_RECORD: [
    "system",
    "useStatus",
    "medicineName",
    "treatmentName",
    "dosage",
    "frequency",
    "route",
    "practitionerName",
    "practitionerRegistrationId",
    "facilityName",
    "startDate",
    "endDate",
    "reportedEffect",
  ],
};

function ConflictView({
  previous,
  current,
  previousStatus,
}: Readonly<{ previous: unknown; current: unknown; previousStatus: string }>) {
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2">
      <article className="rounded-2xl border border-teal/20 bg-teal/5 p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-teal">
          Previous
        </p>
        <p className="mt-3 text-sm leading-6">{display(previous)}</p>
        <div className="mt-3">
          <StatusBadge status={previousStatus} />
        </div>
      </article>
      <article className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-800">
          Current
        </p>
        <p className="mt-3 text-sm leading-6">{display(current)}</p>
        <div className="mt-3">
          <StatusBadge status="CONFLICT" />
        </div>
      </article>
    </div>
  );
}
function StatusBadge({ status }: Readonly<{ status: string }>) {
  const tone =
    status === "CONFLICT"
      ? "bg-amber-100 text-amber-900"
      : status.includes("VERIFIED") || status.includes("CORRECTED")
        ? "bg-teal/10 text-teal"
        : status.includes("REJECTED")
          ? "bg-ink/10 text-ink/60"
          : "bg-ocean/10 text-ocean";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${tone}`}
    >
      {human(status)}
    </span>
  );
}
function ActionButton({
  label,
  onClick,
}: Readonly<{ label: string; onClick(): void }>) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-ink/15 bg-white px-3 py-3 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-ocean/25"
    >
      {label}
    </button>
  );
}
function QueueSkeleton() {
  return (
    <div
      aria-label="Loading verification queue"
      className="grid gap-4 lg:grid-cols-2"
    >
      <div className="h-56 animate-pulse rounded-2xl bg-white" />
      <div className="h-56 animate-pulse rounded-2xl bg-white" />
    </div>
  );
}
function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : { value };
}
function scalar(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : value == null
      ? ""
      : JSON.stringify(value);
}
function display(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object")
    return Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== null && item !== "")
      .map(([key, item]) => `${human(key)}: ${scalar(item)}`)
      .join(" · ");
  return String(value ?? "Not documented");
}
function human(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
function validBox(
  value: unknown,
): value is { x: number; y: number; width: number; height: number } {
  if (!value || typeof value !== "object") return false;
  const box = value as Record<string, unknown>;
  return ["x", "y", "width", "height"].every(
    (key) => typeof box[key] === "number",
  );
}
