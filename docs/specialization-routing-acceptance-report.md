# Specialization-routing acceptance report

**Date:** 2026-09-15  
**Scope:** optional HELIOS patient intake department routing, provider preference, queue handoff, doctor audit, synthetic demo support.

## Delivered

- A versioned, database-seeded taxonomy with 36 specialty records, 34 mapping records, and 12 conservative emergency-pattern drafts.
- Deterministic routing with aliases, bounded fuzzy/singular matching, negation and historical-context handling, confidence bands, alternatives, paediatric fallback, and deterministic tie-breaking.
- Emergency precedence ahead of normal routing and routine submission blocking for a matching draft pattern or an existing open/acknowledged high-risk signal.
- Patient review UI showing a recommended department, alternatives, disclaimers, full department selector, actual available-doctor list, and an explicit provider-choice action.
- Existing-provider-only enforcement: inactive, unclassified, or non-accepting doctors cannot be routed to; no placeholder doctor was created.
- A selected provider is recorded on the visit, audited, and used by the existing transactional check-in/queue assignment path.
- Doctor/admin audit access with signed proof and assignment/administrator authorization.
- Feature-gate correction: when `ENABLE_SPECIALIZATION_ROUTING=false`, ordinary patient submission does not call routing and retains the previous queue behaviour.

## Verification evidence

| Check | Result |
| --- | --- |
| `pnpm typecheck` | passed |
| `pnpm lint` | passed with zero warnings |
| Focused router/API tests | 21 passed; the unrelated DB-only group was correctly skipped without `TEST_DATABASE_URL` |
| Patient routing component tests | 2 passed |
| `pnpm test:db` | 18 passed; fresh isolated PostgreSQL migration had no pending migrations |
| `pnpm test:security` | 29 passed |
| `pnpm demo:reset` + `pnpm demo:verify` | passed; deterministic baseline restored (12 patients, 13 visits, 6 queue tokens) |
| Connected Chromium demo journey | completed from local voice input through routing provider selection, submission, queue call, and doctor clinical-brief review |
| Live local runtime probes | API health 200 with database `up`; `/patient`, `/doctor/login`, and `/sih-demo` each returned 200 |

## Evidence of the critical handoff

The isolated PostgreSQL test seeds the dataset, writes a patient-reported migraine complaint, persists a `neurology` decision, sets a real accepting doctor as `Visit.preferredDoctorId`, runs the normal `QueueService.checkIn`, and asserts both the queue entry’s doctor ID and the active doctor-patient assignment. The connected browser journey independently checks the review-page recommendation, clicks **Choose doctor**, observes **Selected**, submits, then calls the same token from the doctor dashboard.

## Safety and release condition

This is a deterministic, clinician-review-required routing aid. It is not clinically validated decision support, diagnosis, emergency clearance, or booking software. The emergency patterns are conservative draft rules only; no match never reassures. HELIOS has no live SafetyEngine and no automatic risk-signal generator. Before any real-patient use, a qualified local clinical governance process must approve the taxonomy, mappings, emergency wording, availability process, monitoring, and change-control record described in [specialization routing](specialization-routing.md).
