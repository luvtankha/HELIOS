"use client";

import type {
  RoutingAssessmentDto,
  RoutingProviderListDto,
  SpecializationDto,
} from "@helios/shared";
import { useEffect, useState } from "react";
import { specializationRoutingApi } from "@/services/specialization-routing";

export function SpecializationRoutingCard({
  sessionToken,
}: Readonly<{ sessionToken: string | null }>) {
  const [assessment, setAssessment] = useState<RoutingAssessmentDto>();
  const [directory, setDirectory] = useState<RoutingProviderListDto>();
  const [selectedSpecialization, setSelectedSpecialization] = useState<string>();
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(sessionToken));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    if (!sessionToken) return;
    setLoading(true);
    void specializationRoutingApi
      .assess(sessionToken)
      .then((value) => {
        if (!active) return;
        setAssessment(value);
        setSelectedProviderId(value.selectedProviderId);
        setSelectedSpecialization(value.recommendation.primarySpecialization);
      })
      .catch((caught) => active && setError(message(caught)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [sessionToken]);

  useEffect(() => {
    let active = true;
    if (!sessionToken || !assessment || assessment.recommendation.emergencyEscalation)
      return;
    void specializationRoutingApi
      .providers(sessionToken, selectedSpecialization)
      .then((value) => active && setDirectory(value))
      .catch((caught) => active && setError(message(caught)));
    return () => {
      active = false;
    };
  }, [assessment, selectedSpecialization, sessionToken]);

  async function select(providerId: string | null) {
    if (!sessionToken) return;
    setSaving(true);
    setError("");
    try {
      const result = await specializationRoutingApi.select(sessionToken, providerId);
      setSelectedProviderId(result.selectedProviderId);
    } catch (caught) {
      setError(message(caught));
    } finally {
      setSaving(false);
    }
  }
  if (!sessionToken) return null;
  if (loading)
    return (
      <section aria-busy="true" className="rounded-3xl border border-ink/8 bg-white p-5 shadow-sm">
        <h2 className="font-bold">Finding the appropriate department…</h2>
      </section>
    );
  if (error && !assessment)
    return (
      <section role="alert" className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
        Department recommendation is unavailable right now. You can still submit your information for clinic review.
      </section>
    );
  if (!assessment) return null;
  const recommendation = assessment.recommendation;
  if (recommendation.emergencyEscalation)
    return (
      <section role="alert" className="rounded-3xl border-2 border-red-600 bg-red-50 p-5 text-red-950 shadow-sm">
        <p className="text-xs font-black uppercase tracking-widest">Emergency medical evaluation recommended</p>
        <h2 className="mt-2 text-xl font-black">Please do not wait for a routine appointment.</h2>
        <p className="mt-2 text-sm leading-6">{recommendation.reason}</p>
        <p className="mt-3 text-xs leading-5">This automated support check is not a diagnosis. If you believe this is an emergency, contact your local emergency service now.</p>
      </section>
    );
  const primary = nameOf(assessment.specializations, recommendation.primarySpecialization);
  return (
    <section aria-label="Recommended department" className="rounded-3xl border border-teal/20 bg-teal/5 p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-widest text-teal">{recommendation.confidenceBand === "low" ? "Recommended starting point" : "Recommended specialist"}</p>
      <h2 className="mt-1 text-2xl font-bold">{primary}</h2>
      <p className="mt-2 text-sm leading-6 text-ink/75">{recommendation.reason}</p>
      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-ink/60">Priority: {recommendation.urgency}</p>
      {recommendation.alternativeSpecializations.length > 0 && (
        <p className="mt-2 text-sm text-ink/70">Other potentially relevant departments: {recommendation.alternativeSpecializations.map((id) => nameOf(assessment.specializations, id)).join(", ")}</p>
      )}
      <label className="mt-4 block text-sm font-bold">
        Department
        <select
          value={selectedSpecialization ?? ""}
          onChange={(event) => setSelectedSpecialization(event.target.value)}
          className="mt-1 min-h-11 w-full rounded-xl border border-ink/20 bg-white px-3 font-normal"
        >
          {assessment.specializations.map((specialization) => (
            <option value={specialization.id} key={specialization.id}>{specialization.displayName}</option>
          ))}
        </select>
      </label>
      <div className="mt-4" aria-live="polite">
        <p className="text-sm font-bold">Doctors in {nameOf(assessment.specializations, selectedSpecialization ?? recommendation.primarySpecialization)}</p>
        {directory?.providers.length ? (
          <ul className="mt-2 space-y-2">
            {directory.providers.map((provider) => (
              <li key={provider.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3 text-sm">
                <span><strong>{provider.displayName}</strong><span className="block text-xs text-ink/60">{provider.specialization.displayName}</span></span>
                <button type="button" disabled={saving || !provider.acceptingRouting} onClick={() => void select(provider.id)} className="min-h-10 rounded-lg border border-teal px-3 font-bold text-teal disabled:opacity-50">
                  {selectedProviderId === provider.id ? "Selected" : provider.acceptingRouting ? "Choose doctor" : "Not available"}
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 rounded-xl bg-white p-3 text-sm text-ink/65">Recommended specialty identified, but no matching doctor is currently available. You can return to the complete department list or submit for clinic review.</p>}
        {directory && <p className="mt-2 text-xs leading-5 text-ink/55">{directory.availabilityNote}</p>}
      </div>
      {selectedProviderId && <button type="button" disabled={saving} onClick={() => void select(null)} className="mt-3 min-h-10 text-sm font-bold text-ocean underline">Clear doctor choice</button>}
      {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
      <p className="mt-4 text-xs leading-5 text-ink/55">{recommendation.limitations} Dataset status: clinician review required.</p>
    </section>
  );
}
function nameOf(items: SpecializationDto[], id: string) { return items.find((item) => item.id === id)?.displayName ?? id.replaceAll("-", " "); }
function message(error: unknown) { return error instanceof Error ? error.message : "Department routing could not be loaded."; }
