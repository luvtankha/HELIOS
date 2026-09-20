import { useState } from "react";
import type { DocumentEvidenceDto, DocumentFactDto } from "@helios/shared";

export function ExtractedFacts({
  facts,
  busyId,
  onAction,
  onEvidence,
}: Readonly<{
  facts: DocumentFactDto[];
  busyId: string;
  onAction(
    fact: DocumentFactDto,
    action: "confirm" | "edit" | "reject",
    value?: string,
  ): void;
  onEvidence(evidence: DocumentEvidenceDto): void;
}>) {
  if (!facts.length)
    return (
      <div className="rounded-2xl bg-mist p-5 text-sm text-ink/60">
        No supported clinical details were found. Nothing has been inferred.
      </div>
    );
  return (
    <div className="space-y-3">
      {facts.map((fact) => (
        <FactCard
          key={fact.id}
          fact={fact}
          busy={busyId === fact.id}
          onAction={onAction}
          onEvidence={onEvidence}
        />
      ))}
    </div>
  );
}

function FactCard({
  fact,
  busy,
  onAction,
  onEvidence,
}: Readonly<{
  fact: DocumentFactDto;
  busy: boolean;
  onAction(
    fact: DocumentFactDto,
    action: "confirm" | "edit" | "reject",
    value?: string,
  ): void;
  onEvidence(evidence: DocumentEvidenceDto): void;
}>) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(
    displayValue(fact.normalizedValue ?? fact.originalValue),
  );
  const attention =
    fact.status === "NEEDS_REVIEW" || fact.confidenceBand === "LOW";
  return (
    <article className="rounded-2xl border border-ink/10 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-teal">
            {humanize(fact.factType)}
          </p>
          {editing ? (
            <input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="mt-2 min-h-12 w-full rounded-xl border border-ocean px-3"
            />
          ) : (
            <strong className="mt-1 block text-lg">
              {displayValue(fact.normalizedValue ?? fact.originalValue)}
            </strong>
          )}
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${attention ? "bg-amber/20 text-ink" : "bg-teal/10 text-teal"}`}
        >
          {attention
            ? "Please review"
            : fact.status === "CONFIRMED"
              ? "Confirmed"
              : "Found"}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
        {fact.evidence[0] && (
          <button
            onClick={() => onEvidence(fact.evidence[0]!)}
            className="rounded-xl bg-mist px-3 py-2 text-ocean"
          >
            View in document · page {fact.evidence[0].pageNumber}
          </button>
        )}
        {editing ? (
          <button
            disabled={busy}
            onClick={() => onAction(fact, "edit", value)}
            className="rounded-xl bg-ink px-3 py-2 text-white"
          >
            Save correction
          </button>
        ) : (
          <button
            disabled={busy || fact.status === "CONFIRMED"}
            onClick={() => onAction(fact, "confirm")}
            className="rounded-xl bg-teal px-3 py-2 text-white"
          >
            Confirm
          </button>
        )}
        <button
          disabled={busy}
          onClick={() => setEditing((current) => !current)}
          className="rounded-xl border border-ink/10 px-3 py-2"
        >
          {editing ? "Cancel edit" : "Edit"}
        </button>
        <button
          disabled={busy}
          onClick={() => onAction(fact, "reject")}
          className="rounded-xl border border-red-200 px-3 py-2 text-red-700"
        >
          Remove
        </button>
      </div>
      <p className="mt-3 text-xs text-ink/45">
        Source: document extracted · {fact.confidenceBand.toLowerCase()}{" "}
        extraction confidence
      </p>
    </article>
  );
}

function displayValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (value && typeof value === "object")
    return Object.entries(value)
      .map(([key, item]) => `${humanize(key)}: ${String(item)}`)
      .join(" · ");
  return "Unknown";
}

function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
