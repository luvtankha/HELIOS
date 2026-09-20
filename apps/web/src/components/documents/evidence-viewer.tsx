import type { DocumentEvidenceDto, MedicalDocumentDto } from "@helios/shared";
import { useEffect } from "react";
import { DocumentPreview } from "./document-preview";

export function EvidenceViewer({
  document,
  evidence,
  token,
  onClose,
  contentLoader,
}: Readonly<{
  document: MedicalDocumentDto;
  evidence: DocumentEvidenceDto;
  token: string;
  onClose(): void;
  contentLoader?: (documentId: string, token: string) => Promise<string>;
}>) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-ink/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Document evidence"
    >
      <div className="mx-auto grid max-w-6xl gap-4 rounded-3xl bg-[#f6f8f7] p-4 shadow-xl sm:p-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <DocumentPreview
          document={document}
          token={token}
          evidence={evidence}
          {...(contentLoader && { contentLoader })}
        />
        <aside className="min-w-0 rounded-2xl bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-teal">
                Source evidence
              </p>
              <h2 className="mt-2 font-serif text-2xl">
                Page {evidence.pageNumber}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="grid h-10 w-10 place-items-center rounded-full bg-mist"
              aria-label="Close evidence"
            >
              ×
            </button>
          </div>
          <blockquote className="mt-6 rounded-2xl border-l-4 border-teal bg-mist p-4 text-sm leading-6">
            “{evidence.sourceText}”
          </blockquote>
          {evidence.boundingBox && (
            <p className="mt-4 text-xs text-ink/60">
              The matching area is highlighted on the document where supported.
            </p>
          )}
          <p className="mt-4 text-xs text-ink/50">
            Confidence describes extraction quality, not medical certainty.
          </p>
        </aside>
      </div>
    </div>
  );
}
