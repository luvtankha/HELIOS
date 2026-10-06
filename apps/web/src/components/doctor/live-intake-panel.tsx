import type { LiveIntakeDto } from "@helios/shared";

export function LiveIntakePanel({ intake }: { intake: LiveIntakeDto }) {
  return (
    <section
      aria-labelledby="live-intake-title"
      className="mt-5 rounded-3xl border border-teal-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="live-intake-title" className="text-xl font-bold text-slate-900">
          Live consultation intake
        </h2>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
          Patient reported · clinician review tracked per fact
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        Hindi / Hinglish conversation · clinical records in English or Hinglish
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {intake.facts.map((fact) => (
          <div
            key={fact.id}
            className="rounded-xl border border-slate-100 bg-slate-50 p-4"
          >
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {fact.field.replace(/([a-z])([A-Z])/g, "$1 $2")}
            </dt>
            <dd className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold text-slate-900">
              {fact.value ?? "Not known"}
            </dd>
            <dd className="mt-2 text-xs text-slate-500">
              {fact.knowledgeState} ·{" "}
              {fact.confidence ?? "Unspecified confidence"}
            </dd>
            <dd className="mt-2 text-xs font-semibold text-slate-700">
              Review: {(fact.verificationStatus ?? "PATIENT_REPORTED").replaceAll("_", " ").toLowerCase()}
            </dd>
            <dd className="mt-1 text-xs text-slate-500">
              Evidence: {fact.evidenceTurnIds.join(", ")}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
