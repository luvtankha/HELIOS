# Data model and reproducibility

`PatientSnapshot` stores the patient and visit IDs, snapshot schema version, deterministic source revision, content hash, canonical facts, event count, source update time, and generation time. Rows are immutable in application behavior: the unique `(patientId, visitId, sourceRevision)` key returns an existing row rather than rewriting it.

`Comparison` binds an ordered previous/current visit pair to the exact previous/current snapshot rows. Its cache key includes both snapshot hashes and `phase8-v1`. Status is `GENERATED`, `REVIEWED`, `ARCHIVED`, or `STALE`.

`ChangeRecord` stores entity identity, classification and reason, field deltas, values, timeline event IDs, provenance, verification, evidence, matching confidence, review flag, deterministic fingerprint, and an optional link to an existing `RiskSignal`.

Migration `20260909190000_comparison_engine` is checked into source control and must be applied by the deployment operator.
