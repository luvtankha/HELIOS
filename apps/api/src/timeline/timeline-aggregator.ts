import type { TimelineEventDto, TimelineGroupDto } from "@helios/shared";

export class TimelineAggregator {
  group(events: TimelineEventDto[]): TimelineGroupDto[] {
    const groups = new Map<string, TimelineGroupDto>();
    for (const event of events) {
      const key = event.groupKey ?? `event:${event.id}`;
      const current = groups.get(key);
      if (current) {
        current.events.push(event);
        continue;
      }
      groups.set(key, {
        key,
        label: groupLabel(key, event),
        ...(event.eventDate && { eventDate: event.eventDate }),
        datePrecision: event.datePrecision,
        events: [event],
      });
    }
    return [...groups.values()].map((group) => {
      const document = group.events.find((event) =>
        ["MEDICAL_DOCUMENT", "CONSULTATION_NOTE", "DISCHARGE_EVENT"].includes(
          event.eventType,
        ),
      );
      return document ? { ...group, label: document.title } : group;
    });
  }
}

function groupLabel(key: string, event: TimelineEventDto) {
  if (key.startsWith("visit:")) return "Visit";
  if (key.startsWith("document:"))
    return event.title.includes("report") ? event.title : "Medical document";
  return event.title;
}
