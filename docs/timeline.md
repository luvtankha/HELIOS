# Timeline

The implemented `TimelineEvent` layer is a rebuildable chronological **projection**, not the primary clinical record. It indexes visits, patient-reported facts, documents/evidence, observations, verification and persisted risk/AYUSH records while preserving source IDs, dates/precision, temporal state, original/normalized values, verification state, fingerprints and version snapshots. Queries use server-side filters and cursor pagination; uncertain dates sort after known dates. Rebuild reconstructs one authorized patient's projection and does not invent missing events.

See [architecture](timeline/architecture.md), [temporal/provenance model](timeline/temporal-and-provenance-model.md), [API/rebuild](timeline/api-and-rebuild.md), and [limitations](timeline/limitations.md).
