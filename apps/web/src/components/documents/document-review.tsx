import type { MedicalDocumentDto } from "@helios/shared";
import { DocumentDetails } from "./document-details";

export function DocumentReview({
  document,
  children,
}: Readonly<{ document: MedicalDocumentDto; children: React.ReactNode }>) {
  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <div className="rounded-3xl border border-ink/10 bg-white p-6 shadow-soft">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal">
          We found these details
        </p>
        <h2 className="mt-2 font-serif text-3xl">{document.fileName}</h2>
        <p className="mt-2 text-ink/55">
          {document.summary ?? "Please review every extracted detail."}
        </p>
        <div className="mt-5">
          <DocumentDetails document={document} />
        </div>
      </div>
      {children}
    </section>
  );
}
