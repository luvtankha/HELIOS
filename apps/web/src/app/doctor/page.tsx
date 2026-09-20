"use client";

import type { DoctorDashboardDto, DoctorQueueItemDto } from "@helios/shared";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useDoctorAuth } from "@/providers/doctor-auth-provider";
import { doctorDashboardApi } from "@/services/doctor-dashboard";
import { OperationalQueue } from "@/components/doctor/operational-queue";

export default function DoctorDashboardPage() {
  const { session } = useDoctorAuth();
  const [data, setData] = useState<DoctorDashboardDto>();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("time");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search), 300);
    return () => window.clearTimeout(id);
  }, [search]);
  const query = useMemo(() => {
    const params = new URLSearchParams({
      sort,
      direction: "asc",
      page: "1",
      limit: "30",
    });
    if (debounced) params.set("search", debounced);
    if (status) params.set("status", status);
    return params;
  }, [debounced, sort, status]);
  useEffect(() => {
    if (!session) return;
    let current = true;
    setLoading(true);
    setError("");
    doctorDashboardApi
      .dashboard(query, session.doctorToken)
      .then((result) => {
        if (current) setData(result);
      })
      .catch(() => {
        if (current)
          setError("Today’s patient information could not be loaded.");
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [query, session]);
  return (
    <main className="p-5 lg:p-8">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-700">
              Doctor dashboard
            </p>
            <h1 className="mt-1 font-serif text-3xl font-bold text-[#102a43] sm:text-4xl">
              Today’s clinic
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {data?.doctor.displayName ?? session?.displayName} · Queue and
              clinical review
            </p>
          </div>
          <button
            onClick={() => setShowNotifications((value) => !value)}
            aria-expanded={showNotifications}
            className="relative min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold shadow-sm"
          >
            Notifications{" "}
            {data?.notifications.length ? (
              <span className="ml-2 rounded-full bg-rose-600 px-2 py-0.5 text-xs text-white">
                {data.notifications.length}
              </span>
            ) : null}
          </button>
        </div>
        {data?.queueScope === "RECENT_ACTIVE_DEMO_FALLBACK" && (
          <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Demo view: there are no visits dated today, so active synthetic
            visits are shown.
          </p>
        )}
        {showNotifications && data && (
          <section
            aria-label="Notifications"
            className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="font-bold">Notifications</h2>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {data.notifications.length ? (
                data.notifications.map((notice) => (
                  <Link
                    key={notice.id}
                    href={`/doctor/patients/${notice.patientId}?visitId=${notice.visitId}`}
                    className={`rounded-xl border p-3 text-sm ${notice.priority === "HIGH" ? "border-rose-200 bg-rose-50" : "border-slate-200"}`}
                  >
                    <strong className="block">{notice.title}</strong>
                    <span className="text-slate-600">{notice.summary}</span>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  No new clinical notifications.
                </p>
              )}
            </div>
          </section>
        )}
        <section
          aria-label="Queue metrics"
          className="mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 sm:grid-cols-3 xl:grid-cols-5"
        >
          <Metric
            label="Patients today"
            value={data?.metrics.patientsToday}
            tone="navy"
          />
          <Metric label="Waiting" value={data?.metrics.waiting} tone="blue" />
          <Metric
            label="Pending verification"
            value={data?.metrics.pendingVerification}
            tone="amber"
          />
          <Metric
            label="High priority"
            value={data?.metrics.highPriority}
            tone="red"
          />
          <Metric
            label="Verified / complete"
            value={data?.metrics.verifiedOrCompleted}
            tone="green"
          />
        </section>
        <OperationalQueue />
        <section
          id="today-queue"
          className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row">
            <label id="patient-search" className="flex-1">
              <span className="sr-only">Search patients</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, patient ID, phone, complaint or symptom"
                className="min-h-12 w-full rounded-xl border border-slate-300 px-4"
              />
            </label>
            <label>
              <span className="sr-only">Filter status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="min-h-12 rounded-xl border border-slate-300 bg-white px-4"
              >
                <option value="">All statuses</option>
                <option value="WAITING">Waiting</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="NEEDS_REVIEW">Needs review</option>
                <option value="HIGH_PRIORITY_REVIEW">High priority</option>
                <option value="VERIFIED">Verified</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Sort queue</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="min-h-12 rounded-xl border border-slate-300 bg-white px-4"
              >
                <option value="time">Appointment time</option>
                <option value="priority">Priority</option>
                <option value="name">Patient name</option>
              </select>
            </label>
          </div>
          {loading ? (
            <QueueSkeleton />
          ) : error ? (
            <div
              role="alert"
              className="m-5 rounded-xl bg-red-50 p-5 text-red-800"
            >
              <strong>Queue unavailable.</strong>
              <p className="mt-1 text-sm">
                {error} Please refresh to try again.
              </p>
            </div>
          ) : !data?.queue.length ? (
            <div className="p-12 text-center">
              <p className="font-bold">No patients match this view.</p>
              <p className="mt-1 text-sm text-slate-500">
                Try clearing search or status filters.
              </p>
            </div>
          ) : (
            <QueueTable items={data.queue} />
          )}
        </section>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | undefined;
  tone: string;
}) {
  const tones: Record<string, string> = {
    navy: "text-[#102b46]",
    blue: "text-[#17678b]",
    amber: "text-amber-800",
    red: "text-rose-800",
    green: "text-emerald-800",
  };
  return (
    <article className={`rounded-xl p-3 sm:p-4 ${tones[tone]}`}>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums sm:text-3xl">
        {value ?? "—"}
      </p>
    </article>
  );
}

function QueueTable({ items }: { items: DoctorQueueItemDto[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[940px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-5 py-4">Time / token</th>
            <th className="px-5 py-4">Patient</th>
            <th className="px-5 py-4">Reason</th>
            <th className="px-5 py-4">Review load</th>
            <th className="px-5 py-4">Status</th>
            <th className="px-5 py-4">
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr key={item.visitId} className="hover:bg-slate-50">
              <td className="px-5 py-4">
                <strong>
                  {new Date(item.visitDate).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </strong>
                <span className="block text-xs text-slate-500">
                  Token {item.tokenNumber ?? "—"}
                </span>
              </td>
              <td className="px-5 py-4">
                <strong>{item.fullName}</strong>
                <span className="block text-xs text-slate-500">
                  {item.patientCode} · {item.age} ·{" "}
                  {item.sex.replaceAll("_", " ").toLowerCase()}
                </span>
              </td>
              <td className="max-w-xs px-5 py-4 text-slate-600">
                {item.chiefComplaint ?? "No chief complaint recorded"}
              </td>
              <td className="px-5 py-4">
                <span className="block">
                  {item.pendingVerificationCount} verification
                </span>
                <span className="text-xs text-slate-500">
                  {item.openDocumentCount} documents ·{" "}
                  {item.openSafetySignalCount} signals
                </span>
              </td>
              <td className="px-5 py-4">
                <StatusBadge item={item} />
              </td>
              <td className="px-5 py-4">
                <Link
                  href={`/doctor/patients/${item.patientId}?visitId=${item.visitId}`}
                  className="inline-flex min-h-10 items-center rounded-xl bg-[#0b6f69] px-4 font-bold text-white"
                >
                  Open workspace
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function StatusBadge({ item }: { item: DoctorQueueItemDto }) {
  const styles =
    item.priority === "HIGH"
      ? "bg-rose-100 text-rose-800"
      : item.status === "NEEDS_REVIEW"
        ? "bg-amber-100 text-amber-900"
        : item.status === "VERIFIED" || item.status === "COMPLETED"
          ? "bg-emerald-100 text-emerald-800"
          : "bg-blue-100 text-blue-800";
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${styles}`}
    >
      {item.status.replaceAll("_", " ")}
    </span>
  );
}
function QueueSkeleton() {
  return (
    <div
      className="space-y-3 p-5"
      aria-busy="true"
      aria-label="Loading patient queue"
    >
      {[1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className="h-16 animate-pulse rounded-xl bg-slate-100"
        />
      ))}
    </div>
  );
}
