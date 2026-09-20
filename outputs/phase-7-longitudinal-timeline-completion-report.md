# Phase 7 — Longitudinal Patient Timeline Completion Report

## 1. Outcome

HELIOS now has a patient-scoped, source-aware longitudinal timeline that organizes visits, captured history, symptoms, medications, allergies, observations, documents and document facts, persisted risk signals, and doctor-verification records. It is a chronological projection, not a diagnosis or comparison engine.

## 2. Architecture

The implemented path is `source records → TimelineEventBuilder → TimelineNormalizer → TimelineRepository → TimelineConflictService → TimelineAggregator → TimelineService/API → patient UI`. Controllers and React components contain no domain projection logic. `TimelineAuditService` records metadata-minimized reads/rebuilds, and `TimelineRebuildService` reconstructs one patient at a time.

## 3. Timeline index and source of truth

`TimelineEvent` remains the index/presentation layer. Visits, documents, facts, medications, allergies, observations, risks, and verification records remain authoritative. Rebuilding does not manufacture a parallel clinical record.

Deterministic SHA-256 fingerprints combine patient, event type, provenance source, origin ID, and normalized concept key. Same-source reprocessing updates one projection; different source identities remain separate even when their text is similar.

## 4. Temporal model

The schema distinguishes nullable `eventDate`, optional `eventEndDate`, `recordedAt`, `createdAt`, and `updatedAt`. Known document dates are used instead of upload dates. Unknown dates remain null and display as “Historical — date unknown”. Exact, month-only, year-only, range, and unknown precision are supported without manufactured times.

`temporalText` can retain phrases such as “about three years ago”. The timeline accepts upstream normalized dates but does not pretend a relative phrase is an exact day.

## 5. Historical/current and medication state

Temporal state is explicit: current, historical, unknown, discontinued, or not applicable. Document-derived medication events are historical and reported—not automatically current or started. Medication action independently supports started, reported, changed, confirmed, and discontinued; discontinued must be explicitly sourced.

## 6. Source and verification

Provenance source and verification status are independent. Sources are patient reported, voice interview, document extracted, clinical record, doctor verified, system generated, or safety engine. Verification state is draft, captured, AI structured, document extracted, patient confirmed, doctor verified, or rejected.

Every event carries `sourceType` and `sourceId`; optional visit, document, document fact, page, source text, confidence, original/normalized values, and group keys preserve traceability.

## 7. Event coverage

The event type enum covers patient visits, reported symptoms, history updates, medication records/changes, allergies, labs, observations, documents, consultation notes, discharge events, procedures, doctor verification, and risk signals. Interview events require a non-empty captured response; merely asking a question creates no event.

Persisted risk rows are labeled “Safety signal” and sourced as system-generated safety output. They are not presented as diagnoses.

## 8. Observation and document grouping

Each observation/document fact becomes a separate structured event. Facts from the same report share a document group, preventing one enormous text event while keeping Hemoglobin, WBC, platelets, and glucose independently addressable. Visit-related events similarly share a visit group.

## 9. Evidence linking

Document events link `TimelineEvent → DocumentFact → DocumentEvidence`. Timeline detail returns bounded document metadata, evidence text, page, and bounding box without exposing private storage paths. “View report source” deep-links to the existing private document review screen and opens the matching fact evidence when available.

## 10. Duplicate and conflict handling

Stable fingerprints prevent repeat processing of the same source from creating duplicates. The unique document constraint was removed from TimelineEvent so one report may project both a document event and multiple factual events.

Conflict keys compare separate sources for the same medication/allergy/measurement concept. Distinct normalized values remain separate and receive “Needs verification”; they are never silently merged. Lab/observation dates are part of the conflict key, so two legitimate results on different dates are longitudinal records rather than conflicts.

## 11. Versioning and immutability

`TimelineEventVersion` snapshots the prior projected value before a changed event is updated. Rebuild-stale or soft-deleted document projections are versioned and marked rejected rather than silently erased. Original and normalized source values remain available in the index for traceability, while source domain entities remain authoritative.

## 12. Rebuild and incremental updates

The rebuild endpoint reconstructs only the requested patient from source records, upserts active fingerprints, and rejects stale projections. The patient UI initializes once, then uses filtered queries rather than rebuilding for every filter. Document completion, fact confirmation/edit/rejection, identity override, and soft removal update only the affected document projection.

## 13. Timeline APIs

- `GET /api/v1/patients/:patientId/timeline`
- `GET /api/v1/timeline/:eventId`
- `POST /api/v1/patients/:patientId/timeline/rebuild`

List queries support ISO `from`/`to`, event type, document category, source, verification status, 1–50 item limits, opaque cursor, and ascending/descending order. PostgreSQL applies filters and pagination. Default ordering is newest event date first, then recording time, creation time, and ID; unknown dates sort last.

## 14. Authorization and privacy

All timeline endpoints require the HMAC session proof and verify that the server-side session belongs to the patient. Event detail resolves ownership before returning content. Patient DTOs omit private storage keys, raw provider metadata, debug rules, and internal model information. Audit rows contain identifiers, request ID, action, and projected counts—not medical text.

## 15. Patient UI

`/patient/timeline` provides a responsive vertical timeline, grouped visit/report cards, explicit dates and unknown-date labels, source and verification chips, current/historical state, conflict warnings, evidence/detail actions, loading/empty/error states, load-more pagination, newest/oldest ordering, category/source filters, three/six/twelve-month ranges, and custom date ranges. The completion page links to the timeline.

The UI explicitly says it organizes information and does not diagnose or interpret change. It contains no “improved” or “worsened” inference.

## 16. Verification results

Final verification on 2026-09-09:

- Prisma schema validation and client generation passed.
- Strict TypeScript checks passed for shared, API, tools, and web packages.
- ESLint passed with zero warnings.
- Prettier check passed.
- Production shared/API/Next.js build passed and generated `/patient/timeline` among 16 static pages.
- API: 95 tests passed; 5 live-database tests skipped.
- Web: 20 tests passed.
- Combined: 115 tests passed and 5 skipped.

Phase 7 tests cover unknown/partial/range dates, historical document medication behavior, explicit medication action, deterministic source-aware fingerprints, non-merging conflicts, report grouping, rebuild from sources, API filter/range validation, patient-facing provenance/evidence rendering, and absence of diagnostic/comparison language.

## 17. Limitations and repository-state discrepancy

The migration and live rebuild were not applied to PostgreSQL because `TEST_DATABASE_URL` is not configured. The existing integration test now verifies, when enabled, that one document can own multiple timeline events and an event can retain versions.

Medication/allergy source models do not yet have dedicated effective-date/state fields, so they remain unknown unless an explicit dated source supplies them. Relative time conversion depends on upstream normalized data. The current sequential rebuild is appropriate for the MVP, not high-volume production.

The supplied phase statement says Phase 5 is complete, but this checkout contains only `RiskSignal` persistence/seed placeholders and no operational `SafetyEngine`. The timeline safely displays persisted rows if present without claiming the engine exists. Production doctor detail remains withheld until clinician authentication/authorization exists.

## 18. Safety boundary and next phase

Phase 7 never diagnoses, infers progression, interprets lab changes, assumes a historical medication is current, converts unknown to negative, or overwrites conflicting sources. Explicit longitudinal comparison belongs to Phase 8 and is not implemented here. A future doctor view should reuse the same events while adding properly authorized evidence and verification controls rather than exposing them through a patient session token.
