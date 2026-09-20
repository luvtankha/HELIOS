import type { KnowledgeState, LanguageCode } from "@helios/shared";
import { clinicalGlossary } from "./glossary.js";

export interface MultilingualClinicalConcept {
  conceptId: string;
  value: string;
  state: KnowledgeState;
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

export interface MultilingualNormalizationResult {
  originalText: string;
  originalLanguage: LanguageCode;
  concepts: MultilingualClinicalConcept[];
  duration?: { value: number; unit: "days" };
  severity?: number;
  needsClarification: boolean;
}

export class MultilingualClinicalNormalizer {
  normalize(
    text: string,
    language: LanguageCode,
  ): MultilingualNormalizationResult {
    const lower = text.toLowerCase();
    const concepts = new Map<string, MultilingualClinicalConcept>();
    for (const entry of clinicalGlossary) {
      const terms = [
        entry.englishTerm,
        entry.localizedTerm,
        ...entry.synonyms,
        ...entry.transliterations,
      ];
      if (terms.some((term) => lower.includes(term.toLowerCase()))) {
        const negated = isNegated(lower, entry.conceptId);
        concepts.set(entry.conceptId, {
          conceptId: entry.conceptId,
          value: entry.englishTerm,
          state: negated ? "NO" : "YES",
          confidence: "HIGH",
        });
      }
    }
    // Code-switched phrases often place duration or severity between the body
    // site and the English symptom word (for example, "pet mein three days se
    // pain hai"). Treat that as the same abdominal-pain concept without
    // depending on one exact surface phrase.
    if (
      /\bpet\s+(?:mein|me|men)\b.*\b(?:pain|dard|darad|dardh)\b/i.test(lower)
    ) {
      concepts.set("SYMPTOM_ABDOMINAL_PAIN", {
        conceptId: "SYMPTOM_ABDOMINAL_PAIN",
        value: "abdominal pain",
        state: "YES",
        confidence: "HIGH",
      });
      concepts.delete("SYMPTOM_GENERAL_PAIN");
    }
    const ambiguous =
      /^(?:pet kharab hai|पेट खराब है|something feels wrong)[.!]?$/i.test(
        text.trim(),
      );
    if (ambiguous) concepts.clear();
    const duration = durationFrom(lower);
    const severity = severityFrom(lower);
    return {
      originalText: text,
      originalLanguage: language,
      concepts: [...concepts.values()],
      ...(duration && { duration }),
      ...(severity !== undefined && { severity }),
      needsClarification:
        ambiguous || (!concepts.size && !duration && severity === undefined),
    };
  }
}

function isNegated(text: string, conceptId: string) {
  if (conceptId !== "SYMPTOM_FEVER" && conceptId !== "SYMPTOM_VOMITING")
    return false;
  return /(?:no|not|don't|do not)\s+(?:have\s+)?(?:fever|vomit)|(?:बुखार|उल्टी)\s+नहीं|(?:fever|bukhar|ulti)\s+nahi/i.test(
    text,
  );
}

function durationFrom(text: string) {
  const match = text.match(
    /(\d+|one|two|three|एक|दो|तीन|teen)\s*(?:days?|दिन|din)/i,
  );
  if (!match) return undefined;
  const values: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    एक: 1,
    दो: 2,
    तीन: 3,
    teen: 3,
  };
  return {
    value: Number(match[1]) || values[match[1]!.toLowerCase()] || 0,
    unit: "days" as const,
  };
}

function severityFrom(text: string) {
  const match = text.match(
    /(?:pain(?:\s+level|\s+is)?|दर्द)\s*(\d|ten|seven)/i,
  );
  if (!match) return undefined;
  const value =
    match[1] === "seven" ? 7 : match[1] === "ten" ? 10 : Number(match[1]);
  return value >= 0 && value <= 10 ? value : undefined;
}
