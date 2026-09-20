# Clinical brief architecture

Phase 9 builds a generated doctor view from existing structured sources. `ClinicalBriefRepository` selects the bounded current visit, current domain facts, recent documents/observations/history, the latest non-stale Phase 8 comparison, and already-stored risk signals. `ClinicalBriefBuilder` applies deterministic relevance and deduplication rules, creates evidence-bearing claims, groups them into structured sections, and produces a template narrative.

The builder does not run OCR, rebuild the timeline, compare snapshots, evaluate safety, diagnose, or recommend care. A subsystem failure is represented as `UNAVAILABLE`, never as reassuring absence.
