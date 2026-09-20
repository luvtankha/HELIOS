# Clinical brief data model

`ClinicalBrief` records patient, visit, optional Phase 8 comparison, generator and source revision, cache key, version, status, structured section metadata, source references, creator, and prior version. Status is `GENERATED`, `REVIEWED`, `STALE`, or `ARCHIVED`.

`BriefClaim` records section, stable claim key, position, concise text, structured value, source type/ID, evidence references, verification state, extraction confidence, and whether verification is needed. The final prose is never the only stored representation.

Regeneration creates a new version only when structured dependencies change. Prior versions remain auditable and become stale rather than being overwritten.
