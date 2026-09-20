import type { AyushSystem, AyushUseStatus } from "@prisma/client";

export interface NormalizedAyushInput {
  originalName: string;
  normalizedName?: string;
  system: AyushSystem;
  useStatus: AyushUseStatus;
  dosage?: string;
  frequency?: string;
  route?: string;
}

/** Conservative normalization only. It never identifies ingredients or products by similarity. */
export class AyushNormalizer {
  system(value: string | undefined): AyushSystem {
    if (!value) return "UNKNOWN";
    return SYSTEM_NAMES[plain(value)] ?? "UNKNOWN";
  }

  useStatus(value: string | undefined): AyushUseStatus {
    if (!value) return "UNKNOWN";
    return USE_STATES[plain(value)] ?? "UNKNOWN";
  }

  normalize(input: {
    system?: string | undefined;
    useStatus?: string | undefined;
    originalName?: string | undefined;
    dosage?: string | undefined;
    frequency?: string | undefined;
    route?: string | undefined;
  }): NormalizedAyushInput {
    const originalName = clean(input.originalName) || "NOT_SPECIFIED";
    const normalizedName =
      originalName === "NOT_SPECIFIED" ? undefined : originalName;
    return {
      originalName,
      ...(normalizedName && { normalizedName }),
      system: this.system(input.system),
      useStatus: this.useStatus(input.useStatus),
      ...(clean(input.dosage) && {
        dosage: normalizeDose(clean(input.dosage)),
      }),
      ...(clean(input.frequency) && {
        frequency: normalizeFrequency(clean(input.frequency)),
      }),
      ...(clean(input.route) && { route: normalizeRoute(clean(input.route)) }),
    };
  }
}

const SYSTEM_NAMES: Record<string, AyushSystem> = {
  ayurveda: "AYURVEDA",
  आयुर्वेद: "AYURVEDA",
  ஆயுர்வேதம்: "AYURVEDA",
  yoga: "YOGA_NATUROPATHY",
  naturopathy: "YOGA_NATUROPATHY",
  "yoga/naturopathy": "YOGA_NATUROPATHY",
  "yoga & naturopathy": "YOGA_NATUROPATHY",
  unani: "UNANI",
  यूनानी: "UNANI",
  siddha: "SIDDHA",
  homoeopathy: "HOMOEOPATHY",
  homeopathy: "HOMOEOPATHY",
  other: "OTHER_TRADITIONAL_SYSTEM",
  "other traditional system": "OTHER_TRADITIONAL_SYSTEM",
  unknown: "UNKNOWN",
};

const USE_STATES: Record<string, AyushUseStatus> = {
  current: "CURRENT",
  currently: "CURRENT",
  historical: "HISTORICAL",
  "used in the past": "HISTORICAL",
  past: "HISTORICAL",
  stopped: "STOPPED",
  discontinued: "STOPPED",
  unknown: "UNKNOWN",
  "not documented": "NOT_DOCUMENTED",
};

function normalizeDose(value: string) {
  return value.replace(/\b(milligrams?|mgs?)\b/gi, "mg").replace(/\s+/g, " ");
}

function normalizeFrequency(value: string) {
  const mapped: Record<string, string> = {
    "once a day": "once daily",
    "one time daily": "once daily",
    "two times daily": "twice daily",
    "three times a day": "three times daily",
  };
  return mapped[plain(value)] ?? value;
}

function normalizeRoute(value: string) {
  const mapped: Record<string, string> = {
    mouth: "oral",
    "by mouth": "oral",
  };
  return mapped[plain(value)] ?? value;
}

function clean(value: string | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function plain(value: string) {
  return clean(value).toLocaleLowerCase("en-IN");
}
