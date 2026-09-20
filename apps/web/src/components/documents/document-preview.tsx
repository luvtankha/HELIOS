import { useEffect, useState } from "react";
import type { DocumentEvidenceDto, MedicalDocumentDto } from "@helios/shared";
import { documentApi } from "@/services/documents";

export function DocumentPreview({
  document,
  token,
  evidence,
  contentLoader,
}: Readonly<{
  document: MedicalDocumentDto;
  token: string;
  evidence?: DocumentEvidenceDto;
  contentLoader?: (documentId: string, token: string) => Promise<string>;
}>) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let created = "";
    setUrl("");
    setError(false);
    void (contentLoader ?? documentApi.content)(document.id, token)
      .then((value) => {
        created = value;
        if (active) setUrl(value);
        else URL.revokeObjectURL(value);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [attempt, contentLoader, document.id, token]);
  if (error)
    return (
      <div
        role="alert"
        className="grid min-h-72 place-content-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-center"
      >
        <p>Document preview could not be opened.</p>
        <button
          type="button"
          onClick={() => setAttempt((value) => value + 1)}
          className="helios-button-primary px-5"
        >
          Try again
        </button>
      </div>
    );
  if (!url)
    return (
      <div
        className="grid min-h-72 place-items-center rounded-2xl bg-mist text-sm text-ink/50"
        role="status"
        aria-busy="true"
      >
        Opening preview…
      </div>
    );
  if (document.mimeType === "application/pdf")
    return (
      <iframe
        title="Uploaded medical document"
        src={url}
        className="h-[34rem] w-full rounded-2xl border border-ink/10 bg-white"
      />
    );
  const page = document.pages.find(
    (candidate) => candidate.pageNumber === evidence?.pageNumber,
  );
  const box = evidence?.boundingBox;
  return (
    <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-2xl bg-white">
      {/* The URL is a private, session-authenticated object URL created in this browser. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Uploaded medical document"
        className="max-h-[34rem] max-w-full object-contain"
      />
      {box && page?.width && page.height && (
        <span
          aria-label="Highlighted source region"
          className="pointer-events-none absolute border-4 border-teal bg-teal/20 shadow-[0_0_0_9999px_rgba(11,39,72,0.18)]"
          style={{
            left: `${(box.x / page.width) * 100}%`,
            top: `${(box.y / page.height) * 100}%`,
            width: `${(box.width / page.width) * 100}%`,
            height: `${(box.height / page.height) * 100}%`,
          }}
        />
      )}
    </div>
  );
}
