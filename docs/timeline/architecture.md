# Longitudinal timeline architecture

The Phase 7 timeline is an index over existing clinical source entities:

`source records → event builder → normalizer/fingerprint → projection repository → conflict detection → grouping → bounded API → patient UI`

The source records remain authoritative. A timeline event stores enough display data and provenance to remain understandable, but corrections are made in the source domain and reprojected. A changed projection snapshots its earlier values in `TimelineEventVersion`; a removed source rejects its projection with a version rather than silently erasing it.

## Service responsibilities

- `TimelineEventBuilder`: source-specific, conservative mapping.
- `TimelineNormalizer`: normalized keys, deterministic SHA-256 fingerprints, and explicit missing dates.
- `TimelineAggregator`: visual visit/report groups without combining underlying events.
- `TimelineConflictService`: different values under the same semantic key remain separate and receive a conflict label.
- `TimelineRebuildService`: reconstructs only one requested patient from source records.
- `TimelineAuditService`: metadata-minimized view/rebuild audit records.
- `TimelineService`: authorization, query/detail serialization, rebuild orchestration, and incremental document projection.

No service diagnoses, interprets trends, converts unknown to negative, or assumes historical medication is current.
