# Clinical Brief

The Clinical Brief is an implemented, versioned doctor-facing review aid designed for rapid navigation—not a diagnosis. It deterministically selects source-linked patient/visit facts, recent symptoms, changes and documents according to configured bounds, persists structured sections and individual `BriefClaim`s, and exposes evidence. Source revision/cache keys support stale detection; refresh creates a new version. Missing dependencies produce explicit unavailable/partial states rather than invented prose. Doctor review/archival and later verification remain separate actions.

See [architecture](clinical-brief/architecture.md), [data model](clinical-brief/data-model.md), [evidence](clinical-brief/evidence.md), [LLM boundary](clinical-brief/llm-boundary.md), and [limitations](clinical-brief/limitations.md).
