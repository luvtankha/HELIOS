# HELIOS Phase 9 — Clinical Brief completion report

## 1. Architecture

Phase 9 adds a deterministic clinical-brief pipeline on top of the existing patient, visit, interview, timeline, document-fact, comparison, and risk-signal records. The flow is `bounded source query → sanitization → deterministic section builder → narrative renderer/validator → ClinicalBrief and BriefClaim persistence → doctor API and UI`. It does not alter earlier ingestion, extraction, timeline, or comparison engines.

## 2. Schema and migration

Prisma now defines `ClinicalBrief`, `BriefClaim`, `ClinicalBriefStatus`, and `BriefSectionType`, with patient, visit, comparison, creator, version-history, claim, review, and archive relations. The migration `20260910100000_clinical_brief` adds the corresponding enums, tables, indexes, uniqueness constraints, and foreign keys. The schema validates and Prisma Client generation passes. The migration was not applied because this workspace has no configured PostgreSQL database.

## 3. Claim model

Every displayed clinical statement is persisted as a claim with a stable claim key, section and position, human-readable text, optional structured value, source type and source ID, evidence references, verification status, confidence band, and `needsVerification` state. The builder rejects claims without evidence and deduplicates stable claim keys.

## 4. Sources used

The brief uses bounded, structured records already present in HELIOS: patient and visit identity, current complaint, confirmed interview symptoms, medications, allergies, observations, timeline events, normalized document facts, the latest valid Phase 8 comparison, existing risk signals, and doctor verification records. Raw OCR text and uploaded binaries are not parsed by Phase 9.

## 5. Relevance and brevity

Selection is deterministic and configurable. Current-visit facts rank ahead of recent history; configured limits bound symptoms, changes, and documents; recent history is constrained by a month window; stable sorting and claim-key deduplication keep output reproducible. Defaults are 12 recent months, 6 symptoms, 6 changes, and 5 documents.

## 6. Evidence linking

Claims carry one or more evidence references with source kind, source ID, label, excerpt, and available document/fact/page or timeline references. The API exposes both whole-brief evidence and patient-bound individual-claim retrieval. The UI evidence drawer shows source excerpts, identifiers, provenance, and structured values without exposing unrelated patient records.

## 7. Provenance and uncertainty

Patient-reported, document-extracted, doctor-verified, system-derived, and unavailable states remain visibly distinct. Verification and confidence describe capture quality, not medical certainty. Unknown facts remain unknown, `NOT_ASKED` symptoms are omitted, conflicts require verification, and missing allergy information is stated as “not documented,” never converted to “no allergies.”

## 8. Phase 8 comparison integration

The “What changed?” section consumes the persisted latest Phase 8 `Comparison` and its `ChangeRecord` rows directly. Phase 9 does not recreate comparison matching, delta calculation, or change classification. Conflicted changes are displayed descriptively and also create a verification summary.

## 9. Safety boundary

Phase 5 does not contain an operational safety engine in this repository; it contains only `RiskSignal` storage. Phase 9 therefore reads and displays existing active risk signals but never creates, infers, scores, or updates them. When no operational safety result exists, the brief explicitly says “Safety attention status unavailable.” Red styling is reserved for an actual stored risk signal.

## 10. Document integration

Only normalized Phase 6 document facts and their evidence metadata enter the brief. Low-confidence or unverified facts retain their verification state. Phase 9 does not invoke OCR, re-extract documents, or infer meaning from document images. Binary/page rendering remains owned by the existing Phase 6 document viewer.

## 11. Timeline integration

Current medications, allergies, observations, and bounded history are assembled from domain records and Phase 7 timeline facts while retaining source dates and verification metadata. Phase 9 neither rebuilds the timeline nor changes its event semantics.

## 12. Verification workflow

The brief includes a dedicated “Needs verification” section derived from unknown, conflicted, and unverified source states. Doctors can mark a generated brief reviewed; reviewed and archived timestamps and actors are persisted. Review is an acknowledgement of the brief version, not a clinical sign-off or alteration of source facts.

## 13. LLM boundary

The default path is fully deterministic and works without an LLM. An optional candidate narrative may be accepted only after validation against the deterministic facts and prohibited-language checks. Untraceable numbers, diagnoses, prognoses, deterioration claims, and treatment instructions cause fallback to the deterministic renderer.

## 14. API surface

Phase 9 adds create, quick get-or-create, list, detail, refresh, evidence, individual-claim, review, and archive operations:

- `POST /api/v1/patients/:patientId/briefs`
- `GET /api/v1/patients/:patientId/briefs`
- `GET /api/v1/patients/:patientId/clinical-brief`
- `GET /api/v1/briefs/:briefId`
- `POST /api/v1/briefs/:briefId/refresh`
- `GET /api/v1/briefs/:briefId/evidence`
- `GET /api/v1/briefs/:briefId/claims/:claimId`
- `POST /api/v1/briefs/:briefId/review`
- `POST /api/v1/briefs/:briefId/archive`

Zod validates route parameters, query values, and bodies. Shared DTOs keep Prisma payloads out of the public contract.

## 15. Doctor interface

The route `/doctor/patients/:patientId/brief` provides a calm, responsive 30-second review surface. Identity, visit, freshness, and version appear first, followed by today’s reason, safety attention, changes, and verification; longer sections are collapsible. Doctors can refresh, mark reviewed, inspect each claim’s evidence, review all sources, or return to Phase 8 changes. The page offers no prescribing, treatment, diagnosis, prognosis, or test-order action.

## 16. Synthetic demo scenario

The synthetic Aarav scenario now includes a current 9 September 2026 visit, upper abdominal pain and vomiting, a recorded metformin dose difference with conflicting provenance, unchanged laboratory context, and a newly captured breathing response. It exercises Phase 8 change reuse and Phase 9 verification behavior. All demo records remain explicitly synthetic.

## 17. Tests

Phase 9 adds 23 focused tests: 15 deterministic builder/renderer tests, 3 API contract tests, 3 service authorization/staleness tests, and 2 doctor-page tests. Coverage includes provenance, source completeness, conflicts, allergy absence, `NOT_ASKED` versus `UNKNOWN`, missing dependencies, existing risk signals, bounds, deduplication, multilingual content, reproducibility, hallucination rejection, treatment-language rejection, route wiring, patient/visit isolation, stale state, UI evidence, and absence of treatment actions.

The complete workspace suite passes: API 134 passed with 5 database integration tests skipped; web 23 passed. Total executable tests: 157 passed, 5 skipped.

## 18. Security and audit

Every clinical-brief operation requires a signed doctor token and rechecks an active database user with `DOCTOR` or `ADMIN` role. Patient, visit, brief, comparison, and claim relationships are checked before data is returned. Audit events record metadata such as actor, action, identifiers, request ID, version, and counts; they do not copy clinical narrative or evidence excerpts. The existing demo doctor-session mechanism remains explicitly non-production.

## 19. Typecheck, lint, and formatting

Prisma schema validation and Client generation pass. Workspace strict TypeScript checks pass for shared, API, tools, and web projects. ESLint passes with zero warnings. The complete repository passes Prettier verification.

## 20. Production build

The shared package and API TypeScript builds pass. The optimized Next.js production build passes and emits `/doctor/patients/[patientId]/brief` as a server-rendered dynamic route plus the existing static doctor and patient routes.

## 21. Limitations and deployment handoff

This is engineering verification, not clinical validation, regulatory approval, or evidence that the brief is safe for real clinical use. A live database was not configured: `db:check` returns `Database: not_configured`, the migration was not applied, and five database integration tests were skipped. Before deployment, operators must apply migrations, replace demo authentication with organizational identity and patient-assignment authorization, configure strong secrets, validate document navigation permissions, add operational monitoring, and conduct clinician-led safety, usability, bias, localization, and failure-mode evaluation. Safety remains unavailable until a separately validated Phase 5 safety engine exists.

## 22. Phase 10 boundary

No Phase 10 capability was implemented. Standards integrations, production identity/authorization, clinical coding, decision support, treatment recommendations, diagnosis, prognosis, safety inference, and external EHR write-back remain out of scope.
