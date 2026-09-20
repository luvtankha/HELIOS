import { createHash } from "node:crypto";
import type {
  TimelineDatePrecision,
  TimelineEventType,
  TimelineSource,
} from "@prisma/client";

export class TimelineNormalizer {
  key(value: string): string {
    return value
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 120);
  }

  fingerprint(input: {
    patientId: string;
    eventType: TimelineEventType;
    source: TimelineSource;
    sourceId: string;
    normalizedKey: string;
  }): string {
    return createHash("sha256")
      .update(
        [
          input.patientId,
          input.eventType,
          input.source,
          input.sourceId,
          input.normalizedKey,
        ].join("\u001f"),
      )
      .digest("hex");
  }

  date(value: Date | null | undefined): {
    eventDate?: Date;
    datePrecision: TimelineDatePrecision;
  } {
    return value
      ? { eventDate: value, datePrecision: "EXACT_DATE" }
      : { datePrecision: "UNKNOWN" };
  }

  displayValue(value: unknown): string | undefined {
    if (typeof value === "string" || typeof value === "number")
      return String(value);
    if (!value || typeof value !== "object") return undefined;
    const record = value as Record<string, unknown>;
    const name = record.testName ?? record.name ?? record.medication;
    const result = record.result ?? record.value ?? record.dose;
    const unit = record.unit;
    const parts = [name, result, unit].filter(
      (item): item is string | number =>
        typeof item === "string" || typeof item === "number",
    );
    return parts.length ? parts.join(" ") : undefined;
  }
}
