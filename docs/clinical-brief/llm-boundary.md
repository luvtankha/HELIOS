# Optional language-model boundary

Phase 9 defaults to deterministic templates and makes no LLM call. `BriefNarrativeRenderer` accepts only structured claims. Optional candidate prose is rejected when it introduces untraceable numbers, unsupported diagnostic/prognostic language, or treatment-style instructions; the deterministic rendering is then used.

Offline, slow, unavailable, rate-limited, or invalid AI output cannot prevent brief generation. An LLM may change wording only, never facts, verification, changes, safety signals, dates, medications, labs, or symptoms.
