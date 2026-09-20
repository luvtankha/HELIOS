import type { TimelineEventDetailDto } from "@helios/shared";
import Link from "next/link";

export function TimelineDetail({
  detail,
  onClose,
}: {
  detail: TimelineEventDetailDto;
  onClose(): void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-ink/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Timeline event details"
    >
      <div className="mx-auto mt-10 max-w-xl rounded-3xl bg-white p-6 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-teal">
              {detail.event.sourceLabel}
            </p>
            <h2 className="mt-2 font-serif text-3xl">{detail.event.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-full bg-mist text-xl"
            aria-label="Close details"
          >
            ×
          </button>
        </div>
        {detail.event.description && (
          <p className="mt-4 leading-7 text-ink/65">
            {detail.event.description}
          </p>
        )}
        {detail.evidence?.sourceText && (
          <blockquote className="mt-5 rounded-2xl border-l-4 border-teal bg-mist p-4 text-sm leading-6 text-ink/70">
            “{detail.evidence.sourceText}”
            {detail.evidence.pageNumber && (
              <footer className="mt-2 text-xs font-bold text-ink/45">
                Page {detail.evidence.pageNumber}
              </footer>
            )}
          </blockquote>
        )}
        {detail.relatedDocument && (
          <Link
            href={`/patient/documents?documentId=${encodeURIComponent(detail.relatedDocument.id)}${detail.evidence?.documentFactId ? `&factId=${encodeURIComponent(detail.evidence.documentFactId)}` : ""}`}
            className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-ocean px-5 font-bold text-white"
          >
            View report source
          </Link>
        )}
        {detail.versions.length > 0 && (
          <p className="mt-5 text-xs text-ink/45">
            {detail.versions.length} earlier version
            {detail.versions.length === 1 ? "" : "s"} retained for traceability.
          </p>
        )}
        <p className="mt-6 rounded-2xl bg-teal/10 p-4 text-xs leading-5 text-ink/60">
          This timeline organizes recorded information. It does not diagnose or
          interpret changes over time.
        </p>
      </div>
    </div>
  );
}
