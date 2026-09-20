import type {
  TimelineEventType,
  TimelineSource,
  TimelineVerificationStatus,
} from "@helios/shared";

export interface TimelineFilterState {
  category:
    | "ALL"
    | TimelineEventType
    | "DOCUMENT_FILTER"
    | "DOCTOR_VERIFIED_FILTER"
    | "PATIENT_REPORTED_FILTER";
  source: "ALL" | TimelineSource;
  verification: "ALL" | TimelineVerificationStatus;
  range: "ALL" | "3_MONTHS" | "6_MONTHS" | "1_YEAR" | "CUSTOM";
  customFrom: string;
  customTo: string;
  sort: "desc" | "asc";
}

export const defaultTimelineFilters: TimelineFilterState = {
  category: "ALL",
  source: "ALL",
  verification: "ALL",
  range: "ALL",
  customFrom: "",
  customTo: "",
  sort: "desc",
};

export function TimelineFilters({
  value,
  onChange,
}: {
  value: TimelineFilterState;
  onChange(value: TimelineFilterState): void;
}) {
  return (
    <section className="rounded-3xl border border-ink/10 bg-white p-4 shadow-soft">
      <div
        className="flex gap-2 overflow-x-auto pb-2"
        aria-label="Timeline categories"
      >
        {categories.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange({ ...value, category: item.value })}
            className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-bold ${
              value.category === item.value
                ? "bg-ocean text-white"
                : "bg-mist text-ink/65"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Select
          label="Time range"
          value={value.range}
          onChange={(range) =>
            onChange({ ...value, range: range as TimelineFilterState["range"] })
          }
          options={[
            ["ALL", "All history"],
            ["3_MONTHS", "Last 3 months"],
            ["6_MONTHS", "Last 6 months"],
            ["1_YEAR", "Last year"],
            ["CUSTOM", "Custom range"],
          ]}
        />
        <Select
          label="Source"
          value={value.source}
          onChange={(source) =>
            onChange({
              ...value,
              source: source as TimelineFilterState["source"],
            })
          }
          options={[
            ["ALL", "All sources"],
            ["PATIENT_REPORTED", "Patient reported"],
            ["VOICE_INTERVIEW", "Patient interview"],
            ["DOCUMENT_EXTRACTED", "Documents"],
            ["DOCTOR_VERIFIED", "Doctor verified"],
          ]}
        />
        <Select
          label="Order"
          value={value.sort}
          onChange={(sort) =>
            onChange({ ...value, sort: sort as TimelineFilterState["sort"] })
          }
          options={[
            ["desc", "Newest first"],
            ["asc", "Oldest first"],
          ]}
        />
      </div>
      {value.range === "CUSTOM" && (
        <div className="mt-3 grid gap-3 rounded-2xl bg-mist p-3 sm:grid-cols-2">
          <label className="text-xs font-bold uppercase tracking-wider text-ink/50">
            From
            <input
              aria-label="Custom range from"
              type="date"
              value={value.customFrom}
              onChange={(event) =>
                onChange({ ...value, customFrom: event.target.value })
              }
              className="mt-1 min-h-11 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm text-ink"
            />
          </label>
          <label className="text-xs font-bold uppercase tracking-wider text-ink/50">
            To
            <input
              aria-label="Custom range to"
              type="date"
              value={value.customTo}
              onChange={(event) =>
                onChange({ ...value, customTo: event.target.value })
              }
              className="mt-1 min-h-11 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm text-ink"
            />
          </label>
        </div>
      )}
    </section>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="text-xs font-bold uppercase tracking-wider text-ink/50">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-11 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-ink"
      >
        {options.map(([option, label]) => (
          <option key={option} value={option}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

const categories: Array<{
  value: TimelineFilterState["category"];
  label: string;
}> = [
  { value: "ALL", label: "All" },
  { value: "PATIENT_VISIT", label: "Visits" },
  { value: "PATIENT_REPORTED_SYMPTOM", label: "Symptoms" },
  { value: "MEDICATION_RECORDED", label: "Medications" },
  { value: "LAB_RESULT", label: "Lab results" },
  { value: "DOCUMENT_FILTER", label: "Documents" },
  { value: "ALLERGY_RECORDED", label: "Allergies" },
  { value: "DOCTOR_VERIFIED_FILTER", label: "Doctor verified" },
  { value: "PATIENT_REPORTED_FILTER", label: "Patient reported" },
];
