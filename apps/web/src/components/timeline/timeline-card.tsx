import type { TimelineEventDto, TimelineGroupDto } from "@helios/shared";

export function TimelineCard({
  group,
  onDetails,
}: {
  group: TimelineGroupDto;
  onDetails(event: TimelineEventDto): void;
}) {
  return (
    <article className="relative pl-10 sm:pl-14">
      <span className="absolute left-[11px] top-7 h-4 w-4 rounded-full border-4 border-white bg-ocean shadow sm:left-[19px]" />
      <div className="rounded-3xl border border-ink/10 bg-white p-5 shadow-soft sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-teal">
              {formatTimelineDate(group)}
            </p>
            <h2 className="mt-2 font-serif text-2xl">{group.label}</h2>
          </div>
          {group.events.some((event) => event.temporalState === "CURRENT") && (
            <span className="rounded-full bg-teal/10 px-3 py-1 text-xs font-bold text-teal">
              Current
            </span>
          )}
        </div>
        <div className="mt-4 divide-y divide-ink/8">
          {group.events.map((event) => (
            <div key={event.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold text-ink">{event.title}</h3>
                  {event.description && (
                    <p className="mt-1 text-sm leading-6 text-ink/60">
                      {event.description}
                    </p>
                  )}
                  {event.medicationAction && (
                    <p className="mt-1 text-xs font-bold text-ink/45">
                      Medication {event.medicationAction.toLowerCase()}
                    </p>
                  )}
                </div>
                <EventIcon type={event.eventType} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="rounded-full bg-mist px-3 py-1 text-ink/60">
                  Source: {event.sourceLabel}
                </span>
                <span className="rounded-full bg-mist px-3 py-1 text-ink/60">
                  {statusLabel(event.verificationStatus)}
                </span>
                {event.hasConflict && (
                  <span className="rounded-full bg-amber/15 px-3 py-1 text-ink">
                    Needs verification
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onDetails(event)}
                className="mt-3 min-h-11 rounded-xl text-sm font-bold text-ocean underline-offset-4 hover:underline"
              >
                {event.evidence ? "View source" : "View details"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function EventIcon({ type }: { type: TimelineEventDto["eventType"] }) {
  const icons: Partial<Record<TimelineEventDto["eventType"], string>> = {
    PATIENT_VISIT: "●",
    LAB_RESULT: "⌁",
    MEDICAL_DOCUMENT: "▤",
    MEDICATION_RECORDED: "+",
    ALLERGY_RECORDED: "!",
    PATIENT_REPORTED_SYMPTOM: "◉",
    DOCTOR_VERIFICATION: "✓",
    RISK_SIGNAL: "△",
  };
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-mist font-bold text-ocean">
      {icons[type] ?? "·"}
    </span>
  );
}

function formatTimelineDate(group: TimelineGroupDto) {
  if (!group.eventDate)
    return group.datePrecision === "UNKNOWN"
      ? "Historical — date unknown"
      : "Date unavailable";
  const date = new Date(group.eventDate);
  if (group.datePrecision === "YEAR_ONLY") return String(date.getUTCFullYear());
  if (group.datePrecision === "MONTH_ONLY")
    return new Intl.DateTimeFormat("en-IN", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function statusLabel(status: TimelineEventDto["verificationStatus"]) {
  const labels: Record<TimelineEventDto["verificationStatus"], string> = {
    DRAFT: "Draft",
    CAPTURED: "Captured",
    AI_STRUCTURED: "Organized by HELIOS",
    DOCUMENT_EXTRACTED: "From document",
    PATIENT_CONFIRMED: "Patient confirmed",
    DOCTOR_VERIFIED: "Doctor verified",
    REJECTED: "Removed",
  };
  return labels[status];
}
