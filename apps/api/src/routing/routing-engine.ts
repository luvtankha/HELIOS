import type { EmergencyRule, Mapping, RoutingInput, RoutingResult } from "./contracts.js";

export function normalize(value: string): string {
  return value.toLowerCase().normalize("NFKC").replace(/[’']/g, "").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}
const singular = (word: string) =>
  word.length > 5 && word.endsWith("es")
    ? word.slice(0, -2)
    : word.length > 4 && word.endsWith("s")
      ? word.slice(0, -1)
      : word;
function near(a: string, b: string) {
  if (a === b || singular(a) === singular(b)) return true;
  if (a.length < 6 || b.length < 6 || Math.abs(a.length - b.length) > 1) return false;
  let edits = 0, i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return edits + Number(i < a.length || j < b.length) <= 1;
}
// Small phrase-local window; never treat an explicit negative as a positive match.
export function matches(text: string, phrase: string, emergency = false): boolean {
  const rawClauses = text.toLowerCase().split(/[.;!?\n]|\bbut\b|\bhowever\b|लेकिन/);
  const needle = normalize(phrase).split(" ");
  for (const clause of rawClauses) {
    const words = normalize(clause).split(" ");
    for (let start = 0; start <= words.length - needle.length; start++) {
      if (!needle.every((word, offset) => near(words[start + offset]!, word))) continue;
      const before = words.slice(Math.max(0, start - 5), start).join(" ");
      const after = words.slice(start + needle.length, start + needle.length + 3).join(" ");
      if (/\b(no|not|denies|denied|without|never)\b/.test(before) || /^(absent|denied|नहीं)/.test(after)) continue;
      if (emergency && /\b(history of|years ago|last year|previous|resolved|used to|family history|my mother|my father)\b/.test(clause)) continue;
      return true;
    }
  }
  return false;
}

const limitations = "Routing support, not a diagnosis. Match confidence is not a medical probability. These draft rules cannot rule out an emergency; seek immediate help for severe or worsening symptoms.";
export function routeSpecialization(input: RoutingInput, mappings: Mapping[], rules: EmergencyRule[], version: string): RoutingResult {
  const current = [input.complaint, ...(input.symptoms ?? []), input.injury, input.severity, input.clinicalContext?.anatomicalLocation].filter(Boolean).join(". ");
  const text = [current, ...(input.knownConditions ?? []), input.duration, input.clinicalContext?.pregnant ? "pregnant" : ""].filter(Boolean).join(". ");
  const fired = rules.filter(rule => rule.groups.every(group => group.some(term => matches(current, term, true))));
  if (input.clinicalContext?.currentEmergencySignal || fired.length) {
    return { primarySpecialization: "emergency-medicine", alternativeSpecializations: fired.some(r => r.id === "spinal-injury") ? ["trauma", "neurosurgery", "orthopaedics"] : [], confidence: 0.95, confidenceBand: "high", confidenceMeaning: "heuristic_match_not_probability", urgency: "emergency", emergencyEscalation: true, matchedConditions: [], matchedSymptoms: [], emergencyRuleIds: [...fired.map(r => r.id), ...(input.clinicalContext?.currentEmergencySignal ? ["existing-high-risk-signal"] : [])], reason: "Emergency medical evaluation recommended. Do not wait for a routine appointment. Contact local emergency services or the nearest emergency department now.", limitations, version };
  }
  const candidates = mappings.filter(m => m.active && (m.ageGroup !== "child" || (input.age != null && input.age < 18)) && (m.ageGroup !== "adult" || input.age == null || input.age >= 18)).flatMap(mapping => {
    const aliases = mapping.aliases.filter(term => matches(text, term));
    const signals = [...new Set([...mapping.symptomKeywords, ...mapping.injuryKeywords].filter(term => matches(text, term)))];
    const groups = mapping.requiredGroups.length > 0 && mapping.requiredGroups.every(group => group.some(term => matches(text, term)));
    if (!aliases.length && !(groups && signals.length >= mapping.minSignals)) return [];
    const known = (input.knownConditions ?? []).some(condition => mapping.aliases.some(term => matches(condition, term)));
    const score = (known ? 12 : aliases.length ? 8 : 6) + Math.min(3, signals.length) + mapping.priority;
    return [{ mapping, score, signals: [...aliases, ...signals], known }];
  }).sort((a,b) => b.score-a.score || a.mapping.id.localeCompare(b.mapping.id));
  const best = candidates[0];
  const ambiguous = best && candidates[1] && candidates[1].score === best.score && candidates[1].mapping.primarySpecialization !== best.mapping.primarySpecialization;
  const low = !best || Boolean(ambiguous) || best.mapping.id === "general";
  const pediatric = input.age != null && input.age < 18;
  let primary = low
    ? pediatric
      ? "pediatrics"
      : "internal-medicine"
    : best.mapping.primarySpecialization;
  const alternatives = new Set(candidates.slice(0,3).flatMap(c => [c.mapping.primarySpecialization,...c.mapping.secondarySpecializations]));
  if (pediatric && primary !== "obstetrics-gynecology" && primary !== "pediatric-surgery") {
    alternatives.add(primary); primary = "pediatrics";
  }
  if (primary === "nephrology" && matches(text,"diabetes")) alternatives.add("endocrinology");
  if (!alternatives.size) alternatives.add("family-medicine");
  alternatives.delete(primary);
  const severityHigh = /\b(severe|unbearable|[89]|10)\b/.test(input.severity ?? "");
  const urgency = severityHigh || candidates.some(c => c.mapping.urgencyDefault === "urgent") ? "urgent" : best?.mapping.urgencyDefault ?? "soon";
  return { primarySpecialization: primary, alternativeSpecializations: [...alternatives].slice(0,5), confidence: low ? 0.3 : best.known ? 0.9 : 0.72,
    confidenceBand: low ? "low" : best.known ? "high" : "medium", confidenceMeaning: "heuristic_match_not_probability", urgency,
    emergencyEscalation: false, matchedConditions: candidates.slice(0,3).map(c=>c.mapping.id), matchedSymptoms: [...new Set(candidates.slice(0,3).flatMap(c=>c.signals))].slice(0,12), emergencyRuleIds: [],
    reason: low ? "Recommended starting point: a general clinician can assess this broad or overlapping concern and arrange any further referral." : pediatric && primary === "pediatrics" ? "A child-focused clinician is the recommended starting point; relevant specialist services may also be needed." : "Based on the reported concern, this department generally evaluates this type of problem. A clinician must confirm the appropriate referral.", limitations, version };
}
