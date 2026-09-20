# HELIOS Phase 10 — Doctor Verification Completion Report

Date: 10 September 2026  
Scope: Phase 10 only. Phase 11 was not started.

## 1. Repository dependency audit

The implementation was based on executable code, schema, routes, repositories, and tests rather than prior completion claims. Phase 6 Document AI, Phase 7 Timeline, Phase 8 What Changed, and Phase 9 Clinical Brief are present and were reused. RiskSignal persistence exists, but there is no executable Phase 5 SafetyEngine or signal-disposition workflow. Authentication supports signed doctor sessions and database-backed active roles. The repository has no organization, care-team, or doctor-to-patient assignment model.

## 2. DoctorVerification architecture

Reviewable source facts remain the current clinical-state records. `DoctorVerification` is an immutable decision-event ledger that records who acted, what action was taken, the previous and resulting states, original and verified values, evidence references, reason/comment, timestamps, and the source fact version. A verification service owns queue construction, state transitions, conflict handling, authentication, and downstream refresh orchestration. A repository owns fact mapping and the atomic database mutation.

## 3. Verification state machine

The source-state model supports `UNREVIEWED`, `PATIENT_REPORTED`, `AI_STRUCTURED`, `DOCUMENT_EXTRACTED`, `NEEDS_REVIEW`, `DOCTOR_VERIFIED`, `DOCTOR_CORRECTED`, `DOCTOR_REJECTED`, and `SUPERSEDED`, while retaining compatible legacy values. Supported actions are `VERIFY`, `CORRECT`, `REJECT`, `MARK_UNCERTAIN`, `CONFIRM_CURRENT`, `KEEP_PREVIOUS`, and `SUPERSEDE`. Conflict items cannot use generic verify; they require an explicit conflict decision or uncertainty. Invalid transitions and missing required reasons are rejected by the service.

## 4. Data model

Verification status and optimistic `verificationVersion` fields were added to ClinicalHistory, Symptom, Medication, Allergy, Observation, DocumentFact, and InterviewResponse. `DoctorVerification` now carries patient/fact identity, nullable visit identity, enums, old/new states, JSON old/new values, preserved source type, JSON evidence references, authenticated verifier identity, event time, source version, and a unique idempotency key. A Prisma migration performs enum creation/extension, column additions, backfill, constraints, indexes, and foreign keys. Prisma validation and client generation pass. The migration was not applied because no database is configured.

## 5. API endpoints

Implemented signed-doctor endpoints:

- `GET /api/v1/verification-queue`
- `GET /api/v1/patients/:patientId/verification-queue`
- `GET /api/v1/verification/:verificationId`
- `GET /api/v1/patients/:patientId/verification-history`
- `POST /api/v1/verification/:verificationId/verify`
- `POST /api/v1/verification/:verificationId/correct`
- `POST /api/v1/verification/:verificationId/reject`
- `POST /api/v1/verification/:verificationId/uncertain`
- `POST /api/v1/verification/:verificationId/confirm-current`
- `POST /api/v1/verification/:verificationId/keep-previous`
- `POST /api/v1/verification/bulk-verify`
- `GET /api/v1/verification/documents/:documentId`
- `GET /api/v1/verification/documents/:documentId/content`

Queue filtering supports patient, fact/search text, status, source, fact type, and conflict state. Validation errors, stale reviews, forbidden access, and not-found records use the existing structured API error conventions.

## 6. Authorization model

Every verification operation derives the doctor identity from a signed session and verifies that the database user is active and has the doctor role. Client-supplied doctor identity is not trusted. Patient sessions cannot call doctor verification routes. Patient-scoped queries constrain records by patient ID, document access verifies the document belongs to the reviewed patient, and mismatched fact/patient requests fail. Organization and doctor-assignment isolation cannot be enforced because those relationships do not exist in the repository; authenticated active doctors currently have global clinical scope.

## 7. Correction model

Corrections use fact-type-specific structured allowlists rather than arbitrary database fields. The current source fact receives the corrected clinical value and `DOCTOR_CORRECTED`; the ledger and audit log retain the original value, corrected value, source, doctor, evidence, reason, and timestamp. DocumentFact extraction text and document evidence are never rewritten. Correction requires a reason.

## 8. Rejection model

Rejection sets the source fact to `DOCTOR_REJECTED` without deleting it or its evidence. Rejected and superseded source facts are excluded from active Clinical Brief inputs and map to rejected Timeline state. The immutable decision and audit entries preserve why, when, and by whom the fact was rejected. Rejection requires a reason.

## 9. Uncertainty model

`MARK_UNCERTAIN` moves a fact to `NEEDS_REVIEW`. It does not invent a replacement value and does not make the fact doctor-verified. An attributable internal comment/reason may be stored. The item remains visible in the review workflow.

## 10. Conflict resolution

Conflicts are detected by comparing same-patient, same-type, same-key facts where an older doctor-verified value differs from the current candidate. The review panel displays previous and current values side by side with their source/status. Doctors can keep the previous value, confirm the current value, or mark uncertainty. No newer-value preference is applied automatically. Generic verify is hidden in the UI and rejected by the service for a conflict.

## 11. Provenance

`sourceType` and `verificationStatus` remain separate. Verifying a patient report or document extraction changes only verification state; it does not relabel its origin. Original source values, evidence references, event dates, and every decision remain traceable. Verification time is stored separately from the source clinical event time.

## 12. Evidence integration

Document reviews reuse the Phase 6 EvidenceViewer and its page/highlight behavior through doctor-authorized metadata/content loaders. Interview evidence includes question, raw response, original language, normalized response when available, and timestamp. AI/document items expose source, normalized output, extraction text, confidence, and status using non-assertive wording. Voice transcript provenance can flow through interview responses, but audio binaries are not persisted by the current voice subsystem, so an audio player is not available.

## 13. Audit implementation

Each successful decision creates an append-only `DoctorVerification` event and `AuditLog` record in the same transaction as the source-state update and downstream invalidation. Audit details include old/new values, old/new statuses, action, actor, reason/comment, source, fact identity, patient identity, evidence references, and timestamp. Internal doctor comments remain on doctor-authorized data paths.

## 14. Concurrency handling

Every source fact has a monotonically incremented `verificationVersion`. The mutation performs a conditional update against the reviewed version; a stale or competing review affects zero rows and returns a friendly HTTP 409 instruction to refresh. Source update, event history, audit, and stale markers are transactional, preventing partial database state.

## 15. Idempotency

Every action requires an idempotency key with a database uniqueness constraint. Replaying the same request returns the existing decision without a duplicate history or audit event. Reusing a key for a different fact or action is rejected. Bulk verification derives deterministic per-item keys. The test suite covers replay behavior.

## 16. Timeline integration

After a successful commit, the existing Timeline rebuild service regenerates versioned Timeline events from current source facts plus verification history. Source clinical dates remain clinical dates; doctor decision events use verification dates. Verified/corrected/rejected status mappings are represented without rewriting historical events. If rebuild fails after verification commits, the API reports that related views may need refresh instead of rolling back the successful decision.

## 17. What Changed integration

The verification transaction marks active comparisons stale. Regeneration consumes updated source verification state, so a changed value remains a change while its current verification status updates. An integration test confirms the comparison retains the medication change rather than erasing it.

## 18. Clinical Brief integration

The transaction marks active briefs stale. Brief source loading excludes rejected/superseded facts and carries verification status into claims. Regenerated output distinguishes doctor-verified/corrected content from content needing verification while keeping original source provenance. An integration test confirms the updated verification status appears in the brief.

## 19. Safety integration

Existing non-demo RiskSignal records are used only to raise queue workflow priority. Phase 10 does not create severity rules, alter a risk signal, clear a signal after verification, or claim a diagnosis. There is no executable SafetyEngine to invoke. The documented boundary is: update the underlying fact, preserve the signal, and allow a future Phase 5 implementation to re-evaluate its inputs.

## 20. UI implementation

`/doctor/verification` provides operational metrics, stable priority ordering, search and filters, source/status badges, queue cards, conflict indicators, and a focused review dialog. The dialog contains fact, source, evidence, previous/current values, immutable history, structured correction fields, reasons/comments, confirmation controls, and explicit actions. Straightforward high-confidence document facts may be bulk verified; conflicts, medications, allergies, low-confidence facts, and safety-prioritized items require individual review. The layout stacks cleanly for tablet/mobile and links from the doctor workspace.

## 21. Accessibility

The page uses semantic controls, explicit labels, ARIA dialog/status labeling, descriptive button text, keyboard-operable actions, visible focus styles, text plus badges/icons rather than color-only state, loading states, and responsive stacking. Automated component tests exercise primary queue/review interactions; no independent screen-reader or formal WCAG audit was performed.

## 22. Security test results

Verification API/service tests cover missing or patient authentication, inactive/unauthorized doctors, actor derivation instead of forged doctor IDs, patient/fact mismatch, invalid/tampered action payloads, document access checks, conflict restrictions, and replayed requests. The complete repository suite passed. Cross-organization enforcement is untestable because the schema has no organization relationship. Database-backed authorization integration tests are among the five skipped tests when `DATABASE_URL` is absent.

## 23. Verification test results

Phase 10 adds 23 executable tests: 11 service, 4 API, 2 repository concurrency/transaction, 4 integration, and 2 UI tests. They cover verify, correct, reject, uncertain, conflicts, source preservation, evidence requirements, authentication/authorization, idempotency, stale updates, Timeline rebuild/provenance, Comparison, Clinical Brief, and refresh-failure recovery. Full result: API **155 passed, 5 skipped**; web **25 passed**; combined **180 passed, 5 skipped** across 42 passing test files and one skipped database file. The five skipped tests require a live PostgreSQL database.

## 24. Typecheck

`pnpm typecheck` passed for shared, API, API tools, and web TypeScript projects. `pnpm lint` passed with zero warnings. `pnpm format:check` passed. `pnpm db:validate` and `pnpm db:generate` passed with Prisma 6.19.3.

## 25. Build

`pnpm build` passed for shared, API, and web. Next.js completed its optimized production build and generated 18 pages. `/doctor/verification` is included as a static route with a reported 7.58 kB route size and 113 kB first-load JavaScript.

## 26. Known limitations

- The PostgreSQL migration is generated and validated but was not applied; `pnpm db:check` reports `Database: not_configured`.
- Live database transaction, migration, and persistence behavior remains a deployment verification step; five database integration tests were skipped.
- The demo document records use synthetic storage metadata; document bytes must exist in configured storage for live preview.
- Audio playback is unavailable because the current voice subsystem does not persist recordings; transcript evidence remains available through interview data.
- Bulk verification is intentionally limited to non-conflicting, high-confidence DocumentFacts and is processed as individually transactional decisions rather than one all-or-nothing batch.
- The UI received automated interaction/build checks, not a formal assistive-technology, cross-browser, tablet-device, or clinician usability study.
- Doctor-added internal comments are supported; the repository has no standalone doctor-created clinical-fact/note domain model.
- Verification is an attributable workflow decision, not clinical validation, diagnostic proof, or autonomous medical decision-making.

## 27. Unresolved dependency gaps

The repository still lacks (1) organization/tenant relationships, (2) doctor-to-patient or care-team assignments, (3) an executable Phase 5 SafetyEngine and supported signal review dispositions, (4) notification infrastructure, (5) persisted voice audio, and (6) a doctor-authored clinical note/fact model. Phase 10 uses explicit boundaries for these gaps and does not fabricate their behavior. A configured PostgreSQL instance is also required to apply the migration and complete database-backed deployment verification. No Phase 11 work was performed.
