"use client";

import type { DoctorQueueDto, DoctorQueueEntryDto } from "@helios/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useDoctorAuth } from "@/providers/doctor-auth-provider";
import { doctorQueueApi } from "@/services/queue";

export function OperationalQueue({ full = false }: { full?: boolean }) {
  const { session } = useDoctorAuth();
  const [queue, setQueue] = useState<DoctorQueueDto>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<QueueFilter>("ALL");
  useEffect(() => {
    if (!session) return;
    let active = true;
    async function refresh() {
      try {
        const next = await doctorQueueApi.list(session!.doctorToken);
        if (active) {
          setQueue(next);
          setError("");
        }
      } catch {
        if (active) setError("Queue information could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 8_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [session]);
  async function action(work: () => Promise<unknown>) {
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      await work();
      setQueue(await doctorQueueApi.list(session.doctorToken));
    } catch {
      setError("The queue could not be updated. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  const visibleEntries = (queue?.entries ?? []).filter((item) => {
    if (!full) return !TERMINAL_STATUSES.includes(item.status);
    if (filter === "ALL") return true;
    if (filter === "PRIORITY_REVIEW")
      return item.priority === "PRIORITY_REVIEW";
    return item.status === filter;
  });
  return (
    <section
      aria-label="Operational token queue"
      className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-teal-700">
            Live operational queue
          </p>
          <h2 className="mt-1 font-serif text-2xl font-bold">Today’s queue</h2>
          <p className="mt-1 text-sm text-slate-500">
            {queue
              ? `${queue.counts.waiting} waiting · ${queue.counts.called} called · ${queue.counts.inConsultation} in consultation`
              : "Loading queue…"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={busy || queue?.paused}
            onClick={() =>
              void action(() => doctorQueueApi.callNext(session!.doctorToken))
            }
            className="helios-button-primary px-4 text-sm"
          >
            Call next
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void action(() =>
                queue?.paused
                  ? doctorQueueApi.resume(session!.doctorToken)
                  : doctorQueueApi.pause(session!.doctorToken),
              )
            }
            className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-bold"
          >
            {queue?.paused ? "Resume queue" : "Pause queue"}
          </button>
          {!full && (
            <Link
              href="/doctor/queue"
              className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-4 text-sm font-bold"
            >
              Full queue
            </Link>
          )}
        </div>
      </header>
      {full && queue && (
        <nav
          aria-label="Queue filters"
          className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-3"
        >
          {FILTERS.map(([value, label]) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={`min-h-10 rounded-full px-4 text-xs font-bold ${filter === value ? "bg-[#0b2748] text-white" : "border border-slate-300 bg-white text-slate-700"}`}
            >
              {label}
            </button>
          ))}
        </nav>
      )}
      {error && (
        <p
          role="alert"
          className="m-4 rounded-xl bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {loading && !queue ? (
        <div
          aria-busy="true"
          className="m-5 h-28 animate-pulse rounded-xl bg-slate-100"
        />
      ) : !queue?.entries.length ? (
        <p className="p-8 text-center text-sm text-slate-500">
          No tokens are checked in for this queue.
        </p>
      ) : !visibleEntries.length ? (
        <p className="p-8 text-center text-sm text-slate-500">
          No tokens match this filter.
        </p>
      ) : (
        <div className="divide-y divide-slate-100">
          {visibleEntries.slice(0, full ? 100 : 5).map((item) => (
            <QueueItem
              key={item.id}
              item={item}
              busy={busy}
              onAction={(name) =>
                void action(() =>
                  doctorQueueApi.act(item.id, name, session!.doctorToken),
                )
              }
            />
          ))}
        </div>
      )}
      <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
        Server-ordered by stored priority review, then check-in time. Polls
        every 8 seconds; clinical priority is not a diagnosis.
      </p>
    </section>
  );
}

type QueueFilter =
  | "ALL"
  | "WAITING"
  | "CALLED"
  | "IN_CONSULTATION"
  | "COMPLETED"
  | "PRIORITY_REVIEW";
const TERMINAL_STATUSES = ["COMPLETED", "CANCELLED", "NO_SHOW", "SKIPPED"];
const FILTERS: Array<[QueueFilter, string]> = [
  ["ALL", "All"],
  ["WAITING", "Waiting"],
  ["CALLED", "Called"],
  ["IN_CONSULTATION", "In consultation"],
  ["PRIORITY_REVIEW", "Priority review"],
  ["COMPLETED", "Completed"],
];

function QueueItem({
  item,
  busy,
  onAction,
}: {
  item: DoctorQueueEntryDto;
  busy: boolean;
  onAction(action: string): void;
}) {
  const actions: Array<[string, string]> =
    item.status === "WAITING"
      ? [
          ["Call", "call"],
          ["Skip", "skip"],
          ["No show", "no-show"],
        ]
      : item.status === "CALLED"
        ? [
            ["Call again", "recall"],
            ["Start consultation", "start"],
            ["Requeue", "requeue"],
            ["No show", "no-show"],
          ]
        : item.status === "IN_CONSULTATION"
          ? [["Complete", "complete"]]
          : [];
  return (
    <article className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="flex min-w-0 items-center gap-4">
        <span className="rounded-xl bg-[#0b2748] px-3 py-2 text-lg font-black text-white">
          {item.tokenNumber}
        </span>
        <div>
          <Link
            href={`/doctor/patients/${item.patientId}`}
            className="font-bold text-[#102a43] underline-offset-2 hover:underline"
          >
            {item.patientName}
          </Link>
          <p className="text-xs text-slate-500">
            {item.patientCode} · {item.age} years ·{" "}
            {item.chiefComplaint ?? "No chief complaint recorded"}
          </p>
          <p className="mt-1 text-xs font-bold text-slate-600">
            {item.status.replaceAll("_", " ")} ·{" "}
            {item.priority === "PRIORITY_REVIEW"
              ? "Priority review"
              : `Waiting ${item.waitMinutes} min`}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map(([label, name]) => (
          <button
            key={name}
            disabled={busy}
            onClick={() => onAction(name)}
            className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold disabled:opacity-50"
          >
            {label}
          </button>
        ))}
      </div>
    </article>
  );
}
