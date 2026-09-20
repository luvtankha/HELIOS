import type { MedicalDocumentDto } from "@helios/shared";

export function DocumentDetails({
  document,
}: Readonly<{ document: MedicalDocumentDto }>) {
  return (
    <div className="grid gap-3 rounded-2xl bg-mist p-4 text-sm sm:grid-cols-3">
      <div>
        <span className="block text-xs text-ink/45">Document</span>
        <strong>
          {document.documentType.toLowerCase().replaceAll("_", " ")}
        </strong>
      </div>
      <div>
        <span className="block text-xs text-ink/45">Pages</span>
        <strong>{document.pageCount}</strong>
      </div>
      <div>
        <span className="block text-xs text-ink/45">Date</span>
        <strong>
          {document.documentDate
            ? new Date(document.documentDate).toLocaleDateString()
            : "Not documented"}
        </strong>
      </div>
    </div>
  );
}
