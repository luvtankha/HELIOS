import type { LanguageCode } from "@helios/shared";

export interface ClinicalGlossaryEntry {
  conceptId: string;
  englishTerm: string;
  localizedTerm: string;
  synonyms: string[];
  transliterations: string[];
  language: LanguageCode;
  version: number;
}

const concepts = [
  [
    "SYMPTOM_ABDOMINAL_PAIN",
    "abdominal pain",
    "पेट में दर्द",
    ["stomach pain", "belly pain"],
    [
      "pet mein dard",
      "pet me dard",
      "pet men dard",
      "pet mein pain",
      "pet me pain",
    ],
  ],
  ["SYMPTOM_FEVER", "fever", "बुखार", ["temperature"], ["bukhar", "fever"]],
  ["SYMPTOM_HEADACHE", "headache", "सिर दर्द", ["head pain"], ["sir dard"]],
  ["SYMPTOM_VOMITING", "vomiting", "उल्टी", ["vomit", "nausea"], ["ulti"]],
  [
    "SYMPTOM_BREATHING_DIFFICULTY",
    "difficulty breathing",
    "सांस लेने में परेशानी",
    ["shortness of breath"],
    ["saans phool rahi hai", "sans lene mein dikkat"],
  ],
  [
    "SYMPTOM_CHEST_DISCOMFORT",
    "chest discomfort",
    "सीने में तकलीफ",
    ["chest pain"],
    ["seene mein dard"],
  ],
  ["SYMPTOM_DIZZINESS", "dizziness", "चक्कर", ["dizzy"], ["chakkar"]],
  [
    "SYMPTOM_GENERAL_PAIN",
    "pain",
    "दर्द",
    ["ache"],
    ["dard", "darad", "dardh"],
  ],
] as const;

export const clinicalGlossary: ClinicalGlossaryEntry[] = concepts.flatMap(
  ([conceptId, englishTerm, hindiTerm, synonyms, transliterations]) => [
    {
      conceptId,
      englishTerm,
      localizedTerm: englishTerm,
      synonyms: [...synonyms],
      transliterations: [],
      language: "en" as const,
      version: 1,
    },
    {
      conceptId,
      englishTerm,
      localizedTerm: hindiTerm,
      synonyms: [],
      transliterations: [...transliterations],
      language: "hi" as const,
      version: 1,
    },
  ],
);
