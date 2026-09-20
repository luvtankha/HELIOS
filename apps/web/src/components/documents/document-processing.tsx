import type { MedicalDocumentDto } from "@helios/shared";

const stages = [
  ["Uploading document", 5],
  ["Reading document", 40],
  ["Finding important details", 70],
  ["Organizing your records", 90],
  ["Ready", 100],
] as const;

export function DocumentProcessing({
  document,
}: Readonly<{ document: MedicalDocumentDto }>) {
  const progress =
    document.progress ?? statusProgress(document.processingStatus);
  return (
    <div
      className="mx-auto max-w-xl rounded-3xl border border-ink/10 bg-white p-7 shadow-soft"
      aria-live="polite"
    >
      <div className="mb-6 flex items-center gap-4">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-mist text-2xl">
          ▤
        </span>
        <div>
          <strong className="block">{document.fileName}</strong>
          <span className="text-sm text-ink/50">Stored privately</span>
        </div>
      </div>
      <ol className="space-y-4">
        {stages.map(([label, threshold]) => {
          const complete = progress >= threshold;
          const active = !complete && progress >= threshold - 25;
          return (
            <li key={label} className="flex items-center gap-3 text-sm">
              <span
                className={`grid h-7 w-7 place-items-center rounded-full ${complete ? "bg-teal text-white" : active ? "bg-amber text-ink" : "bg-ink/8 text-ink/35"}`}
              >
                {complete ? "✓" : active ? "●" : "○"}
              </span>
              <span
                className={
                  complete || active ? "font-bold text-ink" : "text-ink/45"
                }
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function statusProgress(status: MedicalDocumentDto["processingStatus"]) {
  return {
    UPLOADED: 5,
    VALIDATING: 10,
    PREPROCESSING: 25,
    OCR_PROCESSING: 40,
    LAYOUT_PROCESSING: 55,
    EXTRACTING: 70,
    NORMALIZING: 85,
    REVIEW_REQUIRED: 100,
    VERIFIED: 100,
    FAILED: 0,
    CANCELLED: 0,
  }[status];
}
