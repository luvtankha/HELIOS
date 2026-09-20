# HELIOS Phase 8 — “What Changed?” completion report

## 1. Scope completed

Phase 8 adds a deterministic, source-aware comparison of two recorded patient visits. It includes immutable snapshots, conservative matching, field-level deltas, explicit uncertainty and conflict classes, persistence, cache/version behavior, stale detection, doctor APIs, a responsive review workspace, synthetic demo data, tests, and operating documentation. No Phase 9 capability was implemented.

## 2. Baseline audit and reconciled assumptions

The repository already contained Phase 7 timeline projection, evidence links, document processing, interviews, and `RiskSignal` persistence. It did not contain the `PatientSnapshot` model assumed by the specification, an operational Phase 5 safety engine, or production doctor authentication. Phase 8 therefore adds the missing snapshot model, reads but never creates existing risk signals, and provides a clearly labeled demo-only clinician credential boundary.

## 3. Delivered user outcome

Doctors can open `/doctor/what-changed`, authenticate as a synthetic demo clinician, choose a patient and ordered visit pair, generate a reproducible comparison, filter change classes, keep unchanged records collapsed, inspect recorded values and deltas, and open evidence/provenance in a detail drawer. The UI states that output is descriptive and requires clinical review.

## 4. Deterministic architecture

The pipeline is `TimelineEvent` → `SnapshotBuilder` → `FactNormalizer` → `EntityMatcher` → `FieldComparator` → `ComparisonEngine` → `Comparison`/`ChangeRecord`. Core comparison has no model or network dependency. Fixed templates generate explanations, so an unavailable language model cannot alter clinical comparison behavior.

## 5. Persistence model

Prisma now defines `PatientSnapshot`, `Comparison`, and `ChangeRecord`, plus enumerations for status, change type, entity type, and match confidence. Foreign keys connect patient, ordered visits, exact snapshots, creator, and optional existing risk signal. Indexes support patient history, visit pairs, status, change filters, evidence event IDs, and review queues.

## 6. Immutable snapshots, caching, and stale state

Snapshots contain canonical visit facts, a schema version, deterministic source revision and content hash, source update time, and event count. The application upserts only by the immutable revision key with an empty update. Comparison cache keys hash previous snapshot, current snapshot, and `phase8-v1`. Detail reads recompute both source revisions and mark an older comparison `STALE` when either differs.

## 7. Fact normalization

Normalization performs Unicode NFKC, lowercase/punctuation/whitespace normalization, stable object key ordering, controlled clinical aliases, and conservative quantity parsing. The alias table includes hemoglobin, metformin, glucose, and specified breathing terminology. It does not learn aliases or use uncontrolled fuzzy normalization.

## 8. Entity matching

Entities match only on exact normalized `(entityType, entityKey)`. This supports symptoms, medications, allergies, observations/labs, clinical-history fields, documents, and risk signals. Ambiguous or multiple same-key facts are not silently merged: duplicates become `CONFLICTED` and require review.

## 9. Field comparison and numeric deltas

Fields are compared in stable sorted order. Numeric observations return an absolute delta and percentage delta when the prior value is nonzero. `mcg`, `mg`, and `g` have an explicit safe conversion path. Other identical units compare as recorded; incompatible units yield `NOT_COMPARABLE`. There is no reference-range interpretation.

## 10. Change classification

Persisted classes are `NEW`, `REMOVED`, `CHANGED`, `UNCHANGED`, `CONFLICTED`, `UNKNOWN`, `NOT_COMPARABLE`, and `NEWLY_CAPTURED`. Every result includes a machine reason code and deterministic plain-language explanation.

## 11. Unknown, absence, and conflict safeguards

`NOT_ASKED` and `UNKNOWN` are preserved as knowledge states. Unknown/not-asked → known is `NEWLY_CAPTURED`; known → unknown is `UNKNOWN`. Allergy absence is always `UNKNOWN`, never removal. A previous-only medication or symptom is described as “not reported now,” not stopped or resolved. An unverified current value differing from a doctor-verified prior value is `CONFLICTED`.

## 12. Evidence and existing-system integration

Change records retain before/after timeline event IDs, source, verification status, event date, document/fact/page references, and source excerpt. Document and interview facts enter through Phase 7 timeline projection. Existing `RiskSignal` IDs may be linked, but comparison code has no risk-signal create/update path and performs no safety inference.

## 13. API surface

Added demo doctor session and patient-list routes; comparison create, quick-create, list, detail, filtered changes, and individual change detail routes. Request bodies, route parameters, pagination bounds, and filter enums are validated with Zod. Response DTOs live in `@helios/shared`, not Prisma payloads.

## 14. Security and audit boundary

Protected routes require an HMAC-signed `x-doctor-token`. Every service operation rechecks an active database user with `DOCTOR` or `ADMIN` role. Both visit IDs must resolve under the selected patient and must be chronologically ordered. Audit events store action, identifiers, request ID, and counts only. `POST /doctor-sessions` is explicitly demo-only, controlled by demo mode and `DOCTOR_DEMO_ACCESS_CODE`; it is not production authentication.

## 15. Doctor interface

The new page provides clinician identity, patient/visit selectors, loading/error/empty/stale states, count tiles, change-class filters, priority cards, source-neutral wording, responsive layout, accessible controls, and an evidence drawer. Unchanged items are excluded from the default view but remain available. Red is not used for ordinary change emphasis.

## 16. Synthetic Aarav scenario

Seed data now includes visits dated 10 May and 1 September 2026, hemoglobin 10.4 → 8.9 g/dL with page excerpts, metformin 500 → 1000 mg, and breathing difficulty moving from `NOT_ASKED` to captured `YES`. Timeline fingerprints match the Phase 7 projector so a later rebuild updates rather than duplicates these facts. All scenario labels remain synthetic.

## 17. Verification evidence

- Prisma schema validation: passed.
- Prisma Client generation: passed.
- Workspace strict type checks: passed.
- Workspace lint with zero warnings: passed.
- API and shared TypeScript builds: passed.
- Next.js optimized production build: passed; `/doctor/what-changed` statically generated.
- Final tests: API 113 passed and 5 database integration tests skipped; web 21 passed. Combined: 134 passed, 5 skipped.
- Phase 8 synthetic evaluation: 5/5 labeled fixtures, 100% category accuracy. This is a deterministic regression fixture, not a clinical performance claim.

## 18. Limitations and deployment handoff

The migration is generated and validated but was not applied because no live PostgreSQL deployment was placed in scope; the five database integration tests therefore remain skipped. Before use, an operator must apply migrations, use strong secrets, seed only an explicitly synthetic environment, and replace demo clinician access with the organization’s production identity and authorization system. Phase 5 safety-engine implementation, clinical briefs, standards integrations, and all other Phase 9+ work remain out of scope.
