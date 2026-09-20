import type { ReactNode } from "react";
import { PrimaryCTA, SecondaryCTA } from "./controls";

export function ErrorState({
  message,
  onRetry,
  onLater,
}: Readonly<{
  message: string;
  onRetry(): void;
  onLater?: (() => void) | undefined;
}>) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-200 bg-red-50 p-4 text-left"
    >
      <strong className="block text-red-900">
        We couldn’t save that just now.
      </strong>
      <p className="mt-1 text-sm text-red-800">
        {message} Anything you entered is still on this device.
      </p>
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 rounded-xl bg-red-800 px-4 text-sm font-bold text-white"
        >
          Try again
        </button>
        {onLater && (
          <button
            type="button"
            onClick={onLater}
            className="min-h-11 rounded-xl px-4 text-sm font-bold text-red-900"
          >
            Save and continue later
          </button>
        )}
      </div>
    </div>
  );
}

export function ReviewCard({
  icon,
  title,
  summary,
  onEdit,
}: Readonly<{
  icon: string;
  title: string;
  summary: ReactNode;
  onEdit(): void;
}>) {
  return (
    <section className="flex items-start gap-4 rounded-3xl border border-ink/8 bg-white p-5 shadow-sm">
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-mist text-teal"
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-bold">{title}</h2>
        <div className="mt-1 text-sm leading-6 text-ink/60">{summary}</div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="min-h-11 rounded-xl px-3 text-sm font-bold text-ocean hover:bg-mist"
        aria-label={`Edit ${title}`}
      >
        Edit
      </button>
    </section>
  );
}

export function TokenCard({
  token,
  submittedAt,
}: Readonly<{ token: string; submittedAt: string | null }>) {
  return (
    <section
      className="rounded-[2rem] bg-ink p-7 text-center text-white shadow-soft"
      aria-label="Consultation token"
    >
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/55">
        Your token
      </p>
      <p className="mt-2 break-words text-6xl font-extrabold tracking-tight sm:text-7xl">
        {token}
      </p>
      <p className="mt-3 text-sm text-white/65">
        Submitted{" "}
        {submittedAt
          ? new Date(submittedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "just now"}
      </p>
    </section>
  );
}

export function SuccessActions({
  onDone,
  onSummary,
}: Readonly<{ onDone(): void; onSummary(): void }>) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <PrimaryCTA onClick={onDone}>Done</PrimaryCTA>
      <SecondaryCTA onClick={onSummary}>View summary</SecondaryCTA>
    </div>
  );
}
