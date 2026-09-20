# Evaluation

Tests under `apps/api/tests/clinical-brief` use synthetic data only. They cover patient identity, complaint, symptoms, medications, allergy unknown/absence semantics, observations, documents, Phase 8 changes, existing safety signals, unavailable dependencies, provenance, conflicts, verification, `NOT_ASKED`, deduplication, bounded history, reproducibility, multilingual wording, API validation, authorization proofs, cross-patient visit rejection, stale detection, refresh routes, and unsupported narrative attempts.

These fixtures are software regression checks. They are not clinical validation, medical-device evidence, or a measure of real-world clinical performance.
