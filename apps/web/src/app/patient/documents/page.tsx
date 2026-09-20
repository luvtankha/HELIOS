"use client";

import type {
  DocumentEvidenceDto,
  DocumentFactDto,
  MedicalDocumentDto,
} from "@helios/shared";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DocumentProcessing } from "@/components/documents/document-processing";
import { DocumentReview } from "@/components/documents/document-review";
import { DocumentUpload } from "@/components/documents/document-upload";
import { EvidenceViewer } from "@/components/documents/evidence-viewer";
import { ExtractedFacts } from "@/components/documents/extracted-facts";
import { ErrorState } from "@/components/patient/feedback";
import { PrimaryCTA, SecondaryCTA } from "@/components/patient/controls";
import { PatientShell } from "@/components/patient/patient-shell";
import { useSessionGuard } from "@/hooks/use-session-guard";
import { documentApi } from "@/services/documents";

const processingStates = new Set([
  "UPLOADED",
  "VALIDATING",
  "PREPROCESSING",
  "OCR_PROCESSING",
  "LAYOUT_PROCESSING",
  "EXTRACTING",
  "NORMALIZING",
]);

export default function DocumentsPage() {
  const router = useRouter();
  const flow = useSessionGuard();
  const [selected, setSelected] = useState<File | null>(null);
  const [document, setDocument] = useState<MedicalDocumentDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyFact, setBusyFact] = useState("");
  const [error, setError] = useState("");
  const [evidence, setEvidence] = useState<DocumentEvidenceDto | null>(null);
  const previewUrl = useMemo(
    () => (selected ? URL.createObjectURL(selected) : ""),
    [selected],
  );

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const pollingDocumentId =
    document && processingStates.has(document.processingStatus)
      ? document.id
      : undefined;

  useEffect(() => {
    const token = flow.state.sessionToken;
    if (!pollingDocumentId || !token) return;
    let cancelled = false;
    let timer: number | undefined;
    let delay = 1_000;
    const poll = async () => {
      let keepPolling = true;
      try {
        const status = await documentApi.status(pollingDocumentId, token);
        if (cancelled) return;
        if (!processingStates.has(status.status)) {
          const latest = await documentApi.get(pollingDocumentId, token);
          if (!cancelled) setDocument(latest);
          keepPolling = false;
          return;
        }
        setDocument((current) =>
          current?.id === pollingDocumentId
            ? {
                ...current,
                processingStatus: status.status,
                ...(status.progress !== undefined && {
                  progress: status.progress,
                }),
                ...(status.errorCode && { errorCode: status.errorCode }),
              }
            : current,
        );
      } catch {
        // Keep the latest visible state and retry while processing continues.
      } finally {
        if (!cancelled && keepPolling) {
          delay = Math.min(delay * 2, 5_000);
          timer = window.setTimeout(() => void poll(), delay);
        }
      }
    };
    timer = window.setTimeout(() => void poll(), delay);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [flow.state.sessionToken, pollingDocumentId]);

  useEffect(() => {
    if (!flow.state.sessionToken) return;
    const parameters = new URLSearchParams(window.location.search);
    const documentId = parameters.get("documentId");
    if (!documentId) return;
    void documentApi
      .get(documentId, flow.state.sessionToken)
      .then((loaded) => {
        setDocument(loaded);
        const factId = parameters.get("factId");
        const source = loaded.facts.find((fact) => fact.id === factId)
          ?.evidence[0];
        if (source) setEvidence(source);
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "We couldn’t open that source document.",
        ),
      );
  }, [flow.state.sessionToken]);

  async function uploadAndProcess() {
    if (
      !selected ||
      !flow.state.sessionId ||
      !flow.state.patientId ||
      !flow.state.sessionToken
    )
      return;
    setBusy(true);
    setError("");
    try {
      const uploaded = await documentApi.upload({
        file: selected,
        sessionId: flow.state.sessionId,
        patientId: flow.state.patientId,
        ...(flow.state.visitId && { visitId: flow.state.visitId }),
        token: flow.state.sessionToken,
      });
      setDocument(uploaded);
      setSelected(null);
      setDocument(
        await documentApi.process(uploaded.id, flow.state.sessionToken),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "We couldn’t upload this document.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function factAction(
    fact: DocumentFactDto,
    action: "confirm" | "edit" | "reject",
    value?: string,
  ) {
    if (!document || !flow.state.sessionToken) return;
    setBusyFact(fact.id);
    setError("");
    try {
      setDocument(
        await documentApi.factAction(
          document.id,
          fact.id,
          action,
          flow.state.sessionToken,
          value,
        ),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "We couldn’t save that review.",
      );
    } finally {
      setBusyFact("");
    }
  }

  async function retry() {
    if (!document || !flow.state.sessionToken) return;
    setError("");
    setDocument(
      await documentApi.process(document.id, flow.state.sessionToken),
    );
  }

  async function continueMismatch() {
    if (!document || !flow.state.sessionToken) return;
    setBusy(true);
    try {
      setDocument(
        await documentApi.overrideIdentity(
          document.id,
          flow.state.sessionToken,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  const reviewing =
    document?.processingStatus === "REVIEW_REQUIRED" ||
    document?.processingStatus === "VERIFIED";

  return (
    <PatientShell
      activeStep={3}
      backHref="/patient/review"
      eyebrow="Optional · private · reviewable"
    >
      <div className="mb-8 text-center">
        <h1 className="font-serif text-4xl sm:text-5xl">
          Add a previous medical document
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg leading-7 text-ink/60">
          Upload a prescription, report or discharge summary so HELIOS can
          organize information for your doctor.
        </p>
      </div>

      {error && (
        <div className="mx-auto mb-5 max-w-xl">
          <ErrorState
            message={error}
            onRetry={() =>
              document?.processingStatus === "FAILED"
                ? void retry()
                : setError("")
            }
          />
        </div>
      )}

      {!selected && !document && (
        <DocumentUpload
          busy={busy}
          onFile={setSelected}
          onSkip={() => router.push("/patient/review")}
        />
      )}

      {selected && previewUrl && (
        <div className="mx-auto max-w-2xl rounded-3xl border border-ink/10 bg-white p-5 shadow-soft">
          <p className="mb-4 text-sm font-bold">Preview before upload</p>
          {selected.type === "application/pdf" ? (
            <iframe
              title="Selected document preview"
              src={previewUrl}
              className="h-96 w-full rounded-2xl bg-mist"
            />
          ) : (
            // This is a local camera/file preview selected by the patient.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Selected document preview"
              className="max-h-96 w-full rounded-2xl bg-mist object-contain"
            />
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <SecondaryCTA disabled={busy} onClick={() => setSelected(null)}>
              Retake or choose another
            </SecondaryCTA>
            <PrimaryCTA loading={busy} onClick={() => void uploadAndProcess()}>
              Confirm and upload
            </PrimaryCTA>
          </div>
        </div>
      )}

      {document && processingStates.has(document.processingStatus) && (
        <DocumentProcessing document={document} />
      )}

      {document?.processingStatus === "FAILED" && (
        <div className="mx-auto max-w-xl space-y-3 rounded-3xl bg-white p-6 text-center shadow-soft">
          <h2 className="font-serif text-2xl">
            We couldn’t read this document clearly.
          </h2>
          <p className="text-sm text-ink/55">
            The original is still stored. You can retry without uploading it
            again.
          </p>
          <PrimaryCTA onClick={() => void retry()}>Try again</PrimaryCTA>
          <SecondaryCTA
            onClick={() => {
              setDocument(null);
              setSelected(null);
            }}
          >
            Upload another copy
          </SecondaryCTA>
        </div>
      )}

      {reviewing && document && (
        <DocumentReview document={document}>
          {document.identityStatus === "IDENTITY_MISMATCH" && (
            <div className="rounded-2xl border border-amber bg-amber/10 p-5">
              <strong>Document identity could not be confirmed.</strong>
              <p className="mt-1 text-sm text-ink/60">
                Review the document before attaching its details. Nothing from
                it is available to safety features.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <SecondaryCTA onClick={() => router.push("/patient/review")}>
                  Cancel
                </SecondaryCTA>
                <PrimaryCTA
                  loading={busy}
                  onClick={() => void continueMismatch()}
                >
                  Continue manually
                </PrimaryCTA>
              </div>
            </div>
          )}
          <ExtractedFacts
            facts={document.facts}
            busyId={busyFact}
            onAction={(fact, action, value) =>
              void factAction(fact, action, value)
            }
            onEvidence={setEvidence}
          />
          <PrimaryCTA onClick={() => router.push("/patient/review")}>
            Done reviewing
          </PrimaryCTA>
        </DocumentReview>
      )}

      {evidence && document && flow.state.sessionToken && (
        <EvidenceViewer
          document={document}
          evidence={evidence}
          token={flow.state.sessionToken}
          onClose={() => setEvidence(null)}
        />
      )}
    </PatientShell>
  );
}
