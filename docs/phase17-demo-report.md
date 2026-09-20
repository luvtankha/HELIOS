# Phase 17 — synthetic demonstration status

This is an implementation report, not a claim of end-to-end clinical validation. No PostgreSQL server was listening on localhost:5432 during this work, and Docker was unavailable. The seed, reset and database verifier have **not** been exercised against a live database. Counts below describe the deterministic seed definitions, not verified database rows.

## Architecture and isolation

Patient and doctor frontends use the same authorized API and a dedicated local PostgreSQL demo database. The UI badge is controlled by `NEXT_PUBLIC_DEMO_MODE`; it grants no authority. The seed and reset require `ALLOW_DEMO_SEED=true`, both backend demo flags, a non-production `NODE_ENV`, local PostgreSQL, and a `helios_demo` or `helios_sih_demo` database (or `helios_demo` schema). Both refuse a database containing patient codes outside `DEMO-*`. Reset targets synthetic patients and linked data, `demo.*` accounts, seeded queue counters, and only the `demo-synthetic` storage subdirectory. Ordinary RBAC, auth, document permissions and audit behavior remain enabled.

## Defined showcase inventory (database counts unverified)

| Item                                | Defined in source |
| ----------------------------------- | ----------------: |
| Fictional patients                  |                12 |
| Synthetic doctor accounts           |                 2 |
| Visits                              |                13 |
| Golden-patient PDF documents        |                 3 |
| Golden-patient interview responses  |                 5 |
| Provider-free voice-text simulation |                 1 |
| Queue tokens                        |                 6 |
| Prior synthetic doctor verification |                 1 |

The generated fixture set contains 14 synthetic files (including three golden-patient PDFs). Exact clinical fact, timeline event, and database conversation counts must come from `pnpm demo:verify`; they are intentionally not asserted here. The verifier prints patient, visit, clinical fact, document, timeline, interview response, queue and verification counts and checks minimum patient/token/golden-patient consistency. The queue's six case identities and sequence numbers are stable, while its queue date follows the current Asia/Kolkata clinic day so the queue view works on presentation day.

The golden patient, `DEMO-AARAV-024` (Aarav Sharma), has previous/current visits, Hindi/Hinglish interview text, a simulated transcript, synthetic PDF lab values, patient and extracted facts, a source timeline, a comparison-ready longitudinal record, verification history and queue token. Preseeded document extraction/evidence is a stable synthetic fixture; a live document upload still enters the Phase 6 pipeline. Brief and What Changed results must be generated through their actual API engines at demo time, not hard-coded in the UI.

## Operator setup and credentials

Use `.env.sih-demo.example` as a template for a private `.env.sih-demo.local` at the repository root. Supply a dedicated local database password, a 32+ character session secret, and a random `DOCTOR_DEMO_ACCESS_CODE`. Do not commit them. With Node 24+, run `node --env-file=.env.sih-demo.local --run db:migrate`, then the same command pattern for `demo:reset` and `dev`. Subsequent non-destructive reseeds use `demo:seed`, and `demo:verify` queries the rows, each with that explicit profile. `demo:reset` regenerates clean document fixtures before guarded deletion and reseeding. Doctor usernames are `demo.doctor` and `demo.doctor2` with the operator-configured code, accepted only in demo mode. Patient access uses a new patient session. There is no demo admin credential: Phase 16 deliberately disallows shared demo-code admin authority.

The five-minute presentation and failure recovery instructions are in `docs/demo-script.md`.

## Validation and limitations

Typecheck, lint, Prisma schema validation, and the full API/web unit suite passed locally (253 API tests passed, 8 DB-dependent tests skipped; 33 web tests passed). The production guard was separately invoked with production settings and refused reset before connecting. Production build completed locally. These are static/unit/build results, not evidence that the demo seed/reset, queue transitions, document preview, doctor login, generated brief/comparison or live patient journey succeeded against a running database.

Phase 5 SafetyEngine is absent. The seed removes legacy synthetic risk-card placeholders and does **not** claim a rule-derived safety signal; a queue `PRIORITY_REVIEW` label is not one. Consequently the complete Phase 17 safety acceptance criterion is unmet. No real patient data was used, but the absence of a running demo database also means a runtime audit for pre-existing real data has not been performed. Do not use this build for real clinical care or claim fully end-to-end demonstration until PostgreSQL-backed checks and the missing safety engine are completed.

## Files in this phase

`apps/api/prisma/seed.ts`, `apps/api/prisma/demo-guard.ts`, `apps/api/scripts/reset-demo.ts`, `apps/api/scripts/verify-demo.ts`, `apps/api/tests/demo-environment.test.ts`, `scripts/generate-document-ai-fixtures.mjs`, `apps/api/package.json`, root `package.json`, `.env.sih-demo.example`, `.env.example`, `.gitignore`, `apps/web/src/lib/config.ts`, the patient and doctor shell components, `docs/demo-script.md`, and this report.
