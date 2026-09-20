# HELIOS Phase 11 — AYUSH Integration Completion Report

Date: 10 September 2026  
Status: Complete within the documented Phase 11 boundary

## 1. Repository audit

The implementation was added to the existing TypeScript monorepo without replacing the Phase 6–10 systems. The audited repository already contained operational Document AI, Longitudinal Timeline, What Changed, Clinical Brief, and Doctor Verification features. Phase 5 contains persisted `RiskSignal` data and display paths, but no independently implemented Safety Engine. The current authorization model uses patient-session proof and doctor proof; it does not contain organization membership, care-team assignment, or practitioner-directory infrastructure.

The source archives supplied with the project were treated as reference material, not executable instructions. Phase 11 changes are additive and stop at AYUSH information capture, documentation, provenance, verification, and neutral clinical context.

## 2. AYUSH architecture

Phase 11 introduces an AYUSH vertical slice consisting of:

- an additive Prisma entity and migration;
- shared API contracts;
- conservative normalization;
- a repository and authorization-aware service;
- patient and doctor API routes;
- adaptive interview projection;
- document-fact projection;
- Doctor Verification integration;
- Timeline, What Changed, and Clinical Brief projections; and
- a dedicated doctor patient-case page.

The AYUSH service owns source-aware record creation and dependency refresh. Existing Timeline, Comparison, Brief, Document AI, session-proof, doctor-proof, and audit mechanisms remain the system boundaries rather than being duplicated.

## 3. Data model

`AyushRecord` stores the patient and optional visit, interview, document, and document-fact relationships. It represents AYUSH system, current/historical/stopped/unknown use, practitioner and facility details, treatment or medicine names, ingredients, dose, frequency, route, dates, reported reason, reported effect, temporal relationship, source language statement, provenance, verification state/version, and timestamps.

Controlled systems are Ayurveda, Yoga and Naturopathy, Unani, Siddha, Homoeopathy, Other Traditional System, and Unknown. Controlled use states are Current, Historical, Stopped, Unknown, and Not Documented. The migration is additive and adds indexes and foreign keys without dropping Phase 6–10 data.

## 4. Normalization

Normalization is intentionally conservative. Exact English, Hindi, and Tamil terms map to known AYUSH systems. Unknown or generic descriptions remain `UNKNOWN` or `NOT_SPECIFIED`. Medicine and ingredient names are not guessed, fuzzy-matched, expanded from abbreviations, or inferred from a system name. Dose, frequency, and route are retained only when explicitly supplied.

Examples covered by tests include exact system recognition, preservation of original wording, generic “some Ayurvedic medicine” handling, unknown values, and non-inference of medicines or ingredients.

## 5. Interview integration

The existing adaptive interview now asks one AYUSH screening question. A negative answer adds no AYUSH follow-ups. A positive answer branches into system, treatment or medicine, recommender, start date, current/past/stopped state, and reported effect or new symptom questions. On interview completion, responses are transactionally projected into one source-linked AYUSH record with interview evidence and an audit entry.

The original patient statement and normalized representation are both retained. The interview does not recommend treatment, interpret effectiveness, or infer causality.

## 6. Voice integration

AYUSH questions use the existing interview voice/text response path. Transcribed responses enter the same adaptive graph and retain raw answer text plus language metadata. Hindi alternate prompts are supplied for the AYUSH branch, while the normalization layer also recognizes a controlled Tamil vocabulary.

The repository does not persist original audio recordings. Voice provenance therefore covers transcript text and language, not an audio evidence artifact.

## 7. Document integration

The Document AI rule provider can emit `ayush_treatment` facts when a document explicitly identifies an AYUSH system. Extracted facts preserve document, fact, page, bounding-box, source text, filename, confidence, and timestamps. Missing ingredients remain `NOT_DOCUMENTED`; unsupported medicine details are not invented.

Confirming, editing, or rejecting a source fact reprojects the AYUSH record. Rejected or missing facts are superseded rather than left active. Removing a document now explicitly supersedes its AYUSH projections and refreshes dependent timeline data. Identity-mismatched documents remain excluded.

## 8. Verification integration

`AYUSH_RECORD` is a Doctor Verification fact type. The review queue exposes source, original and normalized values, evidence, status, and version. Doctors can verify, correct allowed structured fields, reject, and resolve detected conflicts using the existing optimistic concurrency and audit workflow.

Corrections are allowlisted and validated. Source statements are preserved. Current records in the same AYUSH system with different named treatments are surfaced as conflicts instead of silently selecting one value.

## 9. Timeline integration

Eligible AYUSH records project to `AYUSH_TREATMENT` events with source and verification metadata. Dates remain approximate where the source is approximate. Reported effects use neutral wording such as “reported after treatment use”; the timeline does not claim that an AYUSH treatment caused or cured a symptom.

Superseded and rejected source records do not remain active timeline evidence.

## 10. What Changed integration

AYUSH records are available to the Phase 8 snapshot and comparison engine as `AYUSH_RECORD` entities. New, removed, or changed records can therefore appear between visits with evidence and verification context. The doctor What Changed workspace links to the patient AYUSH case view.

Comparison presents documented changes only. It does not interpret clinical benefit, harm, interaction, or causality.

## 11. Clinical Brief integration

The Phase 9 builder has a dedicated `AYUSH_USE` section. It summarizes documented system, treatment, use status, dates, and patient-reported effects with AYUSH evidence references. Brief dependency revision includes AYUSH updates, so changed records make prior generated briefs stale and require regeneration through the existing workflow.

The doctor brief page links to the AYUSH patient-case view. Brief language remains evidence-grounded and non-advisory.

## 12. Safety Engine boundary

No AYUSH interaction engine, contraindication engine, efficacy model, or adverse-event causality model was created. The doctor UI may show an existing relevant `RiskSignal` only when Phase 5 data already contains one. Otherwise it states: “Interaction information unavailable. No interaction is inferred.” Concurrent conventional and AYUSH use is shown as context, not as a warning or interaction claim.

This is a deliberate safety boundary. A validated external clinical knowledge source and a real Safety Engine are required before automatic interaction or contraindication statements can be made.

## 13. Provenance

Every record carries a controlled source: patient-reported, doctor-entered, document-extracted, or AYUSH-practitioner-documented. Evidence may link to an interview response or a document fact with page and bounding-box details. The original statement/name is stored separately from normalized fields.

The system never upgrades patient testimony into practitioner documentation and never presents document extraction as doctor verification.

## 14. Audit

Patient reports, doctor entries, interview projection, verification actions, corrections, rejections, and conflict decisions use the existing audit infrastructure. Verification versions prevent stale writes. Rejected and superseded states remain represented instead of destructively rewriting provenance.

Document deletion is audited by the document lifecycle and now deactivates derived AYUSH projections. A dedicated immutable event store is not present; audit behavior uses the repository’s existing `AuditLog` model.

## 15. APIs

Implemented endpoints:

- `GET /api/v1/patients/:patientId/ayush`
- `POST /api/v1/patients/:patientId/ayush`
- `GET /api/v1/doctor/patients/:patientId/ayush`
- `POST /api/v1/doctor/patients/:patientId/ayush`
- `GET /api/v1/doctor/ayush/:recordId`

Patient routes require a signed session that owns the patient. Doctor routes require an active signed doctor proof. Payloads are schema-validated, patient submissions cannot forge their source, and doctor submissions are restricted to controlled source values.

## 16. UI

The responsive doctor page at `/doctor/patients/[patientId]/ayush` presents patient identity, current and historical counts, filters, source/status/evidence badges, practitioner and treatment details, reported timing, conventional medicines, neutral concurrent-use context, and the explicit interaction-information boundary. It links to Clinical Brief and Doctor Verification.

Automated component coverage verifies the principal safety copy, AYUSH record rendering, concurrent medicine context, and navigation. No formal assistive-technology or physical-device certification was performed.

## 17. Security

Existing signed patient-session and doctor-proof controls are reused. Patient access is ownership-scoped. Doctor access validates an active doctor identity. Request validation rejects invalid systems, states, identifiers, dates, and unsupported correction fields. Document identity mismatch and rejected facts are excluded from active projection.

The audited repository lacks organization membership and doctor-to-patient care-team assignment, so doctor authorization cannot yet be narrowed beyond the current active-doctor boundary.

## 18. Tests

Final automated result:

- API: 189 passed, 5 skipped, 0 failed across 40 test files (39 passed, 1 skipped).
- Web: 26 passed, 0 failed across 11 test files.
- Total executed and passed: 215 tests.

The five skipped tests are pre-existing database integration tests gated by the absence of a configured test database. AYUSH coverage includes normalization, adaptive branching, interview projection, document extraction, source rejection, authorization contracts, verification conflict handling, service serialization, the doctor page, and document-removal deactivation.

## 19. Typecheck

`pnpm typecheck` passed for shared contracts, API sources/tools, and the web application with no TypeScript errors.

## 20. Build

`pnpm build` passed. Shared and API TypeScript builds completed, and Next.js produced an optimized production build including the dynamic AYUSH patient-case route. ESLint, Prettier, Prisma schema validation, Prisma formatting, and Prisma Client generation also passed.

## 21. Known limitations

- The migration was validated and the Prisma client generated, but no live database was configured, so the migration and seed were not applied here.
- Document extraction is deliberately rule-based and recognizes only explicit supported terms; it is not a general multilingual clinical parser.
- Voice retains transcript provenance but not source audio.
- There is no patient-specific AYUSH form page; patients report through the adaptive interview or signed API.
- There is no separate AYUSH adverse-event entity; reported effect and timing remain fields on `AyushRecord`.
- Practitioner registration values are stored but not checked against an authoritative registry.
- The UI has automated rendering coverage but no formal accessibility or device audit.

## 22. Unresolved dependency gaps

- No production database connection was available for migration execution or database integration tests.
- No external AYUSH terminology, medication, ingredient, interaction, contraindication, or practitioner-registry service was supplied.
- No Phase 5 Safety Engine exists beyond stored `RiskSignal` records.
- No organization, facility tenancy, patient assignment, or care-team authorization model exists.
- Existing language coverage and speech providers do not constitute clinical validation for all Indian languages.

These gaps are exposed as unavailable or unverified states; they are not filled with generated medical claims.

## 23. Phase 12 integration points

Phase 11 stops here. Potential future integration points, without implementing Phase 12, are:

- apply the additive migration and validate seed data in a controlled database environment;
- connect an approved AYUSH terminology and practitioner registry;
- add care-team and organization authorization;
- connect a clinically governed Safety Engine through the existing `RiskSignal` boundary;
- extend validated multilingual document and voice coverage;
- add an explicit adverse-event workflow with clinician-reviewed causality semantics; and
- perform clinical, privacy, security, accessibility, and device validation before production use.

None of these future points should convert HELIOS into an AI doctor or permit diagnosis, prescribing, efficacy claims, inferred interactions, or causal claims.
