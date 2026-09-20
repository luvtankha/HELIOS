# MTS-Dialog reference analysis

## Scope inspected

The review covered dataset documentation, split sizes, normalized section headers, representative dialogue/summary pairs, augmented-data description, and factuality/omission evaluation materials. Source conversations were inspected only to understand structure and were not copied into HELIOS datasets.

## Useful concepts for HELIOS

- Explicit separation of conversation input, section label, and clinical summary target.
- Normalized history sections: chief complaint, HPI/general history, past medical/surgical history, medications, allergies, family/social history, review of systems, labs, imaging, procedures, and other history.
- Turn-level speaker identity and ordering.
- Factual precision/recall, hallucination rate, and omission rate are more clinically meaningful evaluation dimensions than text overlap alone.
- Corrections and conversational references require context-sensitive extraction.

## HELIOS representation

HELIOS conversations use stable conversation/turn/question IDs, speaker, language, raw text, expected state change, clinical facts, and deterministic next question. Structured summaries remain fact-oriented with provenance. Assessment, diagnosis, plan, disposition, and treatment content are excluded from Phase 4-generated targets because HELIOS is collecting—not authoring clinician decisions.

## Evaluation recommendations

Score exact field/state/value extraction, missing-field detection, contradiction/unknown handling, source accuracy, and unsupported-fact rate. Keep entire patients and conversations within one split. Do not use back-translated MTS-Dialog text as Indian-language evaluation data.
