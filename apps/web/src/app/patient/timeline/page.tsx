"use client";

import type {
  TimelineEventDetailDto,
  TimelineEventDto,
  TimelineGroupDto,
} from "@helios/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ErrorState } from "@/components/patient/feedback";
import { PatientShell } from "@/components/patient/patient-shell";
import { TimelineCard } from "@/components/timeline/timeline-card";
import { TimelineDetail } from "@/components/timeline/timeline-detail";
import {
  defaultTimelineFilters,
  TimelineFilters,
  type TimelineFilterState,
} from "@/components/timeline/timeline-filters";
import { useSessionGuard } from "@/hooks/use-session-guard";
import { timelineApi, type TimelineQuery } from "@/services/timeline";

export default function PatientTimelinePage() {
  const flow = useSessionGuard();
  const [filters, setFilters] = useState(defaultTimelineFilters);
  const [groups, setGroups] = useState<TimelineGroupDto[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [detail, setDetail] = useState<TimelineEventDetailDto>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const patientId = flow.state.patientId;
  const sessionToken = flow.state.sessionToken;
  const initializedPatient = useRef<string | undefined>(undefined);

  const query = useMemo(() => buildQuery(filters), [filters]);

  const load = useCallback(
    async (append = false, paginationCursor?: string) => {
      if (!patientId || !sessionToken) return;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError("");
      try {
        if (!append && initializedPatient.current !== patientId) {
          await timelineApi.rebuild(patientId, sessionToken);
          initializedPatient.current = patientId;
        }
        const page = await timelineApi.list(patientId, sessionToken, {
          ...query,
          ...(append && paginationCursor && { cursor: paginationCursor }),
        });
        setGroups((current) =>
          append ? mergeGroups(current, page.groups) : page.groups,
        );
        setCursor(page.nextCursor);
      } catch {
        setError("We couldn’t load your timeline. Please try again.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [patientId, query, sessionToken],
  );

  useEffect(() => {
    if (patientId && sessionToken) void load(false);
  }, [load, patientId, sessionToken]);

  async function openDetails(event: TimelineEventDto) {
    if (!flow.state.sessionToken) return;
    try {
      setDetail(await timelineApi.detail(event.id, flow.state.sessionToken));
    } catch {
      setError("Timeline details are unavailable. Please try again.");
    }
  }

  return (
    <PatientShell
      backHref="/patient/complete"
      eyebrow="Your history · source aware"
    >
      <section className="mx-auto max-w-4xl">
        <div className="text-center">
          <h1 className="font-serif text-4xl sm:text-5xl">
            Your health timeline
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-lg leading-7 text-ink/60">
            A chronological view of information you shared, uploaded records,
            and clinical review—without interpreting changes or making a
            diagnosis.
          </p>
        </div>
        <div className="mt-7">
          <TimelineFilters value={filters} onChange={setFilters} />
        </div>
        {error && (
          <div className="mt-5">
            <ErrorState message={error} onRetry={() => void load(false)} />
          </div>
        )}
        {loading ? (
          <div className="mt-8 space-y-4" aria-label="Loading timeline">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="ml-10 h-40 animate-pulse rounded-3xl bg-white"
              />
            ))}
          </div>
        ) : groups.length ? (
          <div className="relative mt-8 space-y-6 before:absolute before:bottom-8 before:left-[18px] before:top-8 before:w-px before:bg-ocean/25 sm:before:left-[26px]">
            {groups.map((group) => (
              <TimelineCard
                key={group.key}
                group={group}
                onDetails={(event) => void openDetails(event)}
              />
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-3xl bg-white p-8 text-center shadow-soft">
            <h2 className="font-serif text-2xl">No matching events yet</h2>
            <p className="mt-2 text-sm text-ink/55">
              Try another filter. Unknown dates remain visible under All
              history.
            </p>
          </div>
        )}
        {cursor && !loading && (
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void load(true, cursor)}
            className="mx-auto mt-7 flex min-h-12 items-center rounded-xl border border-ink/15 bg-white px-6 font-bold text-ink disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load more history"}
          </button>
        )}
      </section>
      {detail && (
        <TimelineDetail detail={detail} onClose={() => setDetail(undefined)} />
      )}
    </PatientShell>
  );
}

function buildQuery(filters: TimelineFilterState): TimelineQuery {
  const query: TimelineQuery = { sort: filters.sort, limit: 20 };
  if (
    filters.category !== "ALL" &&
    filters.category !== "DOCUMENT_FILTER" &&
    filters.category !== "DOCTOR_VERIFIED_FILTER" &&
    filters.category !== "PATIENT_REPORTED_FILTER"
  )
    query.eventType = filters.category;
  if (filters.category === "DOCUMENT_FILTER") query.category = "DOCUMENTS";
  if (filters.category === "DOCTOR_VERIFIED_FILTER")
    query.verificationStatus = "DOCTOR_VERIFIED";
  if (filters.category === "PATIENT_REPORTED_FILTER")
    query.sourceType = "PATIENT_REPORTED";
  if (filters.source !== "ALL") query.sourceType = filters.source;
  if (filters.verification !== "ALL")
    query.verificationStatus = filters.verification;
  const months =
    filters.range === "3_MONTHS"
      ? 3
      : filters.range === "6_MONTHS"
        ? 6
        : filters.range === "1_YEAR"
          ? 12
          : 0;
  if (months) {
    const from = new Date();
    from.setUTCMonth(from.getUTCMonth() - months);
    query.from = from.toISOString();
  }
  if (filters.range === "CUSTOM") {
    if (filters.customFrom)
      query.from = new Date(
        `${filters.customFrom}T00:00:00.000Z`,
      ).toISOString();
    if (filters.customTo)
      query.to = new Date(`${filters.customTo}T23:59:59.999Z`).toISOString();
  }
  return query;
}

function mergeGroups(
  current: TimelineGroupDto[],
  incoming: TimelineGroupDto[],
) {
  const merged = new Map(current.map((group) => [group.key, group]));
  for (const group of incoming) {
    const existing = merged.get(group.key);
    merged.set(
      group.key,
      existing
        ? { ...existing, events: [...existing.events, ...group.events] }
        : group,
    );
  }
  return [...merged.values()];
}
