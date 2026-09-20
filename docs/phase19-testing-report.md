# Phase 19 — Complete Testing, QA, and End-to-End Validation

**Execution date:** 2026-09-14  
**Repository:** HELIOS monorepo (`pnpm`, Next.js, Express, Prisma/PostgreSQL, Vitest, Playwright)  
**Final QA decision:** **NOT READY**

## Local PostgreSQL connection follow-up

After the user supplied the PostgreSQL administrator password, the existing PostgreSQL 18 service on `127.0.0.1:5432` was inspected. It had only the default `postgres` database and no `helios` login or database. A new empty `helios` database was created, owned by a generated-password `helios_app` role with no superuser, createdb, or createrole privileges. All 16 HELIOS migrations applied. The application credential and generated session/access secrets are stored only in the ignored local `.env`; the administrator password was not reused in the application configuration.

The root local run and database commands now load `.env` explicitly. `pnpm db:migrate` reported no pending migrations, `pnpm db:check` reported `up`, and a temporary `pnpm dev` run returned HTTP 200 from `/patient`, `/health`, and `/api/v1/health`; the API health payload reported `database: up`. A direct non-superuser connection saw 38 public tables. This normal development database is **empty** and was not demo-seeded. The earlier synthetic demo/test results below remain separate. The temporary app processes were stopped after verification, while the PostgreSQL Windows service remains running.

## Executive result

The current regression set contains **310 unique automated test cases**: 266 API/backend cases, 33 web/component cases, and 11 Playwright browser cases. All have passed across the verified runs. In the latest root `pnpm test` execution, 258 API and 33 web cases passed, while eight database-only API cases explicitly skipped because the isolated `TEST_DATABASE_URL` was not set; those same eight cases passed in the earlier dedicated PostgreSQL run. The two newest document-router regressions passed in both the focused and latest root runs.

The 310-case total does not count repeated category/coverage executions or the 40 HTTP requests in the load smoke. The controlled load smoke completed **40/40 successful requests** separately.

The build is **NOT READY** for the final SIH demonstration. Passing automated tests cannot compensate for two release-gate gaps:

1. Phase 5 `SafetyEngine` is not implemented; only `RiskSignal` storage and honest unavailable-state UI exist. The supplied attachment set contains no Phase 5 implementation specification, so clinical escalation rules were not invented.
2. One connected Hindi patient-to-doctor journey now passes through the queue, live Clinical Brief, verification, and completion. Patient intake setup still uses API calls; the complete browser-driven interview/document/What Changed/Safety SIH journey is not automated end to end.

No production data was used. No test or load command was allowed to target a non-local database or HTTP host. After authorized administrator access was provided, the pre-existing PostgreSQL 18 Windows service received two dedicated least-privilege application databases: empty `helios` for normal development and synthetic-only `helios_sih_demo` for the connected demonstration. Phase 19 also used separate temporary PostgreSQL databases on loopback port 55432 for the original isolated regression. The isolated test cluster was stopped after validation; its temporary data directory was retained for reproducibility.

Follow-up inspection confirmed the existing server remains healthy and requires SCRAM password authentication. pgAdmin has two registered profiles for port 5432, including one named `helios`, configured with the `postgres` role. The `.env.example` URL was changed to explicit replacement placeholders so it cannot be mistaken for a provisioned `helios:helios` login. The pgAdmin login was not automated or its saved secret extracted. Authorized credentials subsequently allowed creation and validation of the dedicated application database described above.

## Test environment

| Item            | Actual environment                                                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| OS              | Windows, PowerShell                                                                                                                |
| Package manager | pnpm 11.19.0                                                                                                                       |
| Frontend        | Next.js 15.5.25 production build                                                                                                   |
| Backend         | TypeScript/Express backend tested in-process with Vitest/Supertest-style API tests                                                 |
| Browser         | Playwright Chromium                                                                                                                |
| Database        | Existing PostgreSQL 18 service at 127.0.0.1:5432; least-privilege `helios_app` owns empty `helios` and synthetic `helios_sih_demo` |
| Test database   | Separate temporary PostgreSQL 18 cluster used at 127.0.0.1:55432; `helios_test` and `helios_sih_demo_phase19`; stopped after QA    |
| Providers       | Mock/local providers used where covered; no live STT/OCR/AI provider certification performed                                       |
| Data            | Synthetic fixtures, including 14 generated document fixtures                                                                       |
| Load target     | `http://127.0.0.1:3000/patient` only                                                                                               |

`scripts/assert-test-environment.mjs` rejects production mode, remote database hosts, non-PostgreSQL URLs, and database/schema names that do not start with `helios_test`. Missing configuration causes the database-only integration cases to skip explicitly rather than silently targeting another database. In the final run, `TEST_DATABASE_URL` pointed to the dedicated `helios_test` database and no case skipped.

All 16 migrations applied on the isolated demo database. On the first test-database migration attempt, PostgreSQL rejected `20260910140000_doctor_verification` because it used new `VerificationStatus` enum values before commit. The additive `20260910135000_verification_status_values` migration commits those values first, preserving the checksum/history of the existing doctor-verification migration. After resolving the failed test-only migration record, all migrations applied and the database health check passed.

## Results by category

| Category             | Tests/probes run | Passed | Failed | Skipped | Evidence and limitations                                                                                                                                                                                                      |
| -------------------- | ---------------: | -----: | -----: | ------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit services        |               80 |     80 |      0 |       0 | Interview, clinical NLU, timeline, comparator, Clinical Brief builder, queue, verification, and language suites passed. Broader deterministic coverage also exists in the complete API suite. No SafetyEngine exists to test. |
| Integration          |               16 |     16 |      0 |       0 | All four files passed against isolated PostgreSQL, including the eight previously skipped database cases. This does not prove every transaction/concurrency pattern.                                                          |
| API-focused          |               44 |     44 |      0 |       0 | Twelve API test files passed, including expected safe 4xx paths. This is broad route coverage, not a proof that every endpoint/status permutation exists.                                                                     |
| Web/component        |               33 |     33 |      0 |       0 | Fourteen files cover patient pages, doctor pages, queue, waiting, document, timeline, brief, verification, AYUSH, and voice state/recorder behavior. Not every design-system primitive has an isolated test.                  |
| Security regression  |               29 |     29 |      0 |       0 | Phase 16 simulations, hardening, comparison security, and document security passed. Live DB isolation, deployed TLS/proxy behavior, and production identity were not tested.                                                  |
| Browser E2E          |               11 |     11 |      0 |       0 | Seven responsive, two accessibility, one performance, and one live connected queue/brief/verification case passed. Full intake/document/What Changed remains incomplete.                                                      |
| Document route guard |                2 |      2 |      0 |       0 | New API regressions prove unrelated traffic does not consume the document quota and document endpoints remain limited. Included in the API total.                                                                             |
| Accessibility subset |                2 |      2 |      0 |       0 | Axe found no serious/critical violations on `/patient` and `/doctor/login` after remediation. This is not formal accessibility certification and does not cover authenticated screens.                                        |
| Responsive subset    |                7 |      7 |      0 |       0 | Patient: 375, 390, 768 px. Doctor login: 1024, 1280, 1440, 1920 px. Authenticated tables, modals, documents, timeline, and voice controls were not browser-tested at every width.                                             |
| Performance sample   |                1 |      1 |      0 |       0 | Production-build `/patient` sample: response end 4 ms, DOM content loaded 51 ms, load 85 ms. One local sample; no dashboard/API/database/query or memory-leak characterization.                                               |
| Load smoke           | 40 HTTP requests |     40 |      0 |       0 | Concurrency 5; median 15 ms, p95 26 ms, max 26 ms. Only the local patient entry was exercised; this is not capacity testing of clinical operations.                                                                           |
| Demo safety guards   |                4 |      4 |      0 |       0 | Guard tests pass, including production reset rejection. Real synthetic seed, verify, reset, and re-verify also passed on the dedicated demo database.                                                                         |
| Coverage run         | 297 Vitest cases |    297 |      0 |       0 | Re-execution with PostgreSQL: API 264 passed; web 33 passed. Playwright is not included in V8 source coverage.                                                                                                                |
| Latest root Vitest   | 299 Vitest cases |    291 |      0 |       8 | Latest `pnpm test` passed, with the eight database-only cases explicitly skipped without `TEST_DATABASE_URL`. They had passed in the earlier isolated-DB run. Lint and typecheck passed after the limiter fix.                |

### Unique automated-case total

| Suite              |  Passed | Failed | Skipped |   Total |
| ------------------ | ------: | -----: | ------: | ------: |
| API/backend Vitest |     266 |      0 |       0 |     266 |
| Web Vitest         |      33 |      0 |       0 |      33 |
| Playwright         |      11 |      0 |       0 |      11 |
| **Total**          | **310** |  **0** |   **0** | **310** |

## Functional coverage assessment

| Product area             | Evidence                                                                                                               | QA assessment                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Interview/adaptive NLU   | Engine, NLU, API, patient flow, and multilingual cases pass                                                            | Covered at unit/API level; full browser flow not executed                                            |
| Voice                    | Voice service/API, provider, recorder hook, and state-machine cases pass                                               | Mock/local paths covered; live microphone and real provider not certified                            |
| Document AI/OCR          | API, service, provider, evaluation, local OCR, security, and synthetic fixtures pass                                   | Automated backend coverage exists; browser viewer workflow and live OCR provider not fully exercised |
| Timeline                 | Engine, rebuild, API, patient component, and DB integrity cases pass                                                   | Deterministic and DB-backed coverage exists; full browser journey not executed                       |
| What Changed             | Comparator, evaluation, API, security, and doctor component cases pass                                                 | Covered without a live historical DB scenario                                                        |
| Clinical Brief           | Builder, service, API, component, and live doctor workspace case pass                                                  | Connected patient's record-backed brief renders; broader document and longitudinal cases remain      |
| Verification             | Service, repository, integration/API, DB, UI, and live doctor confirmation pass                                        | Connected doctor action persists and history API confirms it; other variants remain unit/API tested  |
| AYUSH                    | Normalization, interview, service, document, verification, API, and UI cases pass                                      | Covered; no unsupported equivalence is intentionally inferred                                        |
| Multilingual             | English/Hindi/Hinglish normalization, API, locale, and UI-related tests pass                                           | No full visual Hindi journey or live Hindi speech test                                               |
| Queue/token              | Service/API/UI, dedicated DB integration, and live connected browser scenario pass                                     | Hindi intake reaches WAITING, then doctor actions drive CALLED, IN_CONSULTATION, and COMPLETED       |
| Patient/doctor isolation | Security/API simulations, isolated DB checks, and separate live browser contexts pass                                  | Broader authorization permutations and a deployed multi-user isolation audit remain unverified       |
| Failure recovery         | Provider failures, malformed/oversized requests, unavailable dependencies, and UI error states have automated coverage | No deployed network/SSE outage journey or DB recovery drill                                          |
| SafetyEngine             | No executable subsystem found                                                                                          | **Release blocker: not testable and not implemented**                                                |

## Coverage summary

V8 source coverage was generated successfully:

| Workspace |         Statements |           Branches |         Functions |              Lines |
| --------- | -----------------: | -----------------: | ----------------: | -----------------: |
| API       | 57.82% (2183/3775) | 45.50% (1483/3259) | 57.99% (591/1019) | 58.81% (2095/3562) |
| Web       |  54.66% (744/1361) |  50.04% (600/1199) |  50.60% (249/492) |  57.12% (718/1257) |

No arbitrary threshold was imposed. High-risk gaps are more important than the aggregate number: database repositories remain only partially covered; the connected queue lifecycle is browser-tested but the complete clinical workspace journey is not; and SafetyEngine coverage is impossible because the subsystem is absent.

## Defects and findings

### Open release blockers / high issues

#### P1-1901 — SafetyEngine is absent

- **Severity:** P1 — major, blocks an important clinical safety workflow
- **Description:** The repository contains `RiskSignal` persistence and displays stored signals, but no deterministic, versioned SafetyEngine or rule set.
- **Steps to reproduce:** Search application code for an executable `SafetyEngine`; open a doctor patient workspace and observe the explicit unavailable message.
- **Expected:** Every configured safety rule is deterministic and tested for trigger state, severity, provenance, version, timestamp, negation, historical, unknown, missing, and conflicting values.
- **Actual:** No engine/rules exist; the UI correctly refuses to claim risk-free status.
- **Affected phase:** Phase 5 and all downstream safety-dependent demo steps.
- **Status:** OPEN / NOT IMPLEMENTED.

#### P1-1903 — Complete patient/doctor SIH E2E journey remains incomplete

- **Severity:** P1 — major, blocks the final demonstration gate
- **Description:** A live connected Hindi patient/doctor journey now passes against `helios_sih_demo`, including the Clinical Brief, a source-linked verification action, persisted verification history, and completion. It starts intake through API calls and does not cover the complete browser-driven interview, document upload/extraction, What Changed, Safety, and doctor-note workflow.
- **Steps to reproduce:** Run `pnpm test:e2e:connected` and inspect the one connected case alongside the eleven total Playwright cases.
- **Expected:** Full patient intake through waiting/called/completion, full doctor review through verification/completion, and one connected Hindi SIH scenario.
- **Actual:** Public responsive/a11y/performance checks and the connected queue/brief/verification lifecycle pass. The broader clinical journey is not yet represented by browser automation.
- **Affected phase:** Phases 2–14, 17–19.
- **Status:** PARTIALLY FIXED / OPEN. The connected integration gate is covered with API-driven intake; the complete browser SIH journey remains open.

### Fixed findings

#### P1-1907 — Document limiter throttled every API route

- **Severity:** P1 — major, interrupted a legitimate connected consultation
- **Description:** `createDocumentRouter` installed `documentRateLimit` at its router root. Because the router is mounted at `/api/v1`, every subsequent API request consumed the document-specific 20/minute quota, including patient status and doctor queue calls.
- **Steps to reproduce:** Before the fix, run the connected scenario through doctor verification and attempt to start consultation; the queue action returns HTTP 429 with `RATE_LIMITED` despite fewer than 30 queue mutations.
- **Expected:** Only document endpoints consume the document quota; queue actions use the dedicated queue mutation limiter.
- **Actual:** The 21st overall API request was blocked by the document limiter.
- **Fix:** Scope the limiter to `/documents` within the document router. Two focused regressions verify unrelated traffic is unaffected and document endpoints remain limited. The expanded connected browser scenario and 29 security cases pass.
- **Status:** FIXED.

#### P1-1902 — Database-backed integration was initially unavailable

- **Severity:** P1 — major, initially blocked proof of core data integrity
- **Description:** The existing PostgreSQL service was not authenticated by the repository's example credentials, so eight database tests initially skipped.
- **Steps to reproduce:** Run `pnpm test:integration` without `TEST_DATABASE_URL`.
- **Expected:** A dedicated `helios_test` database runs the database integration cases.
- **Actual:** Initial run skipped eight cases; the final isolated PostgreSQL run passed all 16 integration cases.
- **Affected phase:** Data foundation, verification, queue/token, demo environment.
- **Fix:** Created a separate loopback-only PostgreSQL 18 test cluster on port 55432, applied migrations, and set `TEST_DATABASE_URL` to `helios_test`.
- **Status:** FIXED in the Phase 19 test environment; deployment-specific DB validation remains out of scope.

#### P1-1906 — Fresh database migration failed on enum commit ordering

- **Severity:** P1 — major, blocked installation on the tested PostgreSQL version
- **Description:** `20260910140000_doctor_verification` added `VerificationStatus` values and used them in the same migration transaction.
- **Steps to reproduce:** Run `prisma migrate deploy` on a new PostgreSQL 18 `helios_test` database before the additive fix.
- **Expected:** All migrations apply on a fresh isolated database.
- **Actual:** PostgreSQL error `55P04` (`unsafe use of new value "PATIENT_REPORTED"`).
- **Affected phase:** Phase 10 verification and all later fresh installs.
- **Fix:** Added preceding `20260910135000_verification_status_values` migration; preserved the original migration file. All 16 migrations then applied on both fresh test and demo databases.
- **Status:** FIXED and verified on PostgreSQL 18.

#### P2-1904 — Patient helper text failed WCAG AA contrast

- **Severity:** P2 — moderate accessibility defect
- **Description:** The patient entry helper used `text-ink/60`, producing 4.08:1 contrast on `#f6f8f7`.
- **Steps to reproduce:** Run `pnpm test:a11y` before the fix and scan `/patient` with Axe.
- **Expected:** At least 4.5:1 for normal-size text.
- **Actual:** Initial Playwright run: one serious `color-contrast` violation.
- **Affected phase:** Phase 18 UI polish.
- **Fix:** Increased helper text to `text-ink/70`.
- **Status:** FIXED; full Playwright rerun 10/10 passed.

#### P3-1905 — Coverage output caused lint to inspect generated assets

- **Severity:** P3 — minor tooling/regression defect
- **Description:** After coverage generation, web lint scanned `coverage/block-navigation.js` and failed on a generated warning.
- **Steps to reproduce:** Run `pnpm test:coverage`, then `pnpm lint` before the fix.
- **Expected:** Generated reports are excluded from source lint.
- **Actual:** Lint exited non-zero with one warning from generated Istanbul output.
- **Affected phase:** Phase 19 test tooling.
- **Fix:** Added `coverage/**` to the web ESLint ignores.
- **Status:** FIXED; `pnpm lint` passes.

### Severity totals

| Severity            | Open | Fixed |
| ------------------- | ---: | ----: |
| P0 Critical         |    0 |     0 |
| P1 Major            |    2 |     3 |
| P2 Moderate         |    0 |     1 |
| P3 Minor/UI/tooling |    0 |     1 |

## Acceptance checklist

- [x] Unit tests pass
- [x] Integration tests pass without skips against isolated PostgreSQL
- [x] API tests pass
- [x] Frontend/component tests pass
- [ ] End-to-end patient flow passes
- [ ] End-to-end doctor flow passes
- [x] Patient/doctor connected integration passes against the synthetic demo database, with API-driven intake and UI-backed brief, verification, and queue
- [x] Mock/local voice and fallback tests pass
- [x] Document backend tests pass
- [ ] SafetyEngine tests pass — subsystem absent
- [x] Timeline tests pass at unit/API/component level
- [x] What Changed tests pass at unit/API/component level
- [x] Clinical Brief tests pass at unit/API/component level
- [x] Verification tests pass, including the available DB paths
- [x] AYUSH tests pass
- [x] Multilingual automated tests pass
- [x] Available token/queue DB integration and concurrency cases pass
- [x] Security regression suite passes in the supplied environment
- [x] Public-surface automated accessibility checks pass
- [x] Requested public responsive widths pass
- [x] Synthetic demo seed/reset and golden-record consistency pass against a dedicated demo DB
- [x] Covered failure-recovery tests pass; deployed outage drill remains open
- [x] Limited local performance sample completed
- [x] Safe local load smoke completed
- [x] No unresolved P0 defect found
- [x] Phase 18 regression suites pass after the contrast fix
- [ ] Final SIH demo flow passes

## Commands executed

```powershell
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm test:integration
pnpm test:api
pnpm test:security
pnpm --filter @helios/api exec vitest run tests/test-environment-guard.test.ts
pnpm --filter @helios/api exec vitest run tests/demo-environment.test.ts
pnpm test:e2e
pnpm test:e2e:connected
pnpm test:load
pnpm test:coverage
pnpm --filter @helios/api test -- --reporter=dot
pnpm --filter @helios/web test -- --reporter=dot
$env:TEST_DATABASE_URL='postgresql://helios_test_runner@127.0.0.1:55432/helios_test?schema=public'
$env:DATABASE_URL=$env:TEST_DATABASE_URL
pnpm test:integration
pnpm test
pnpm test:coverage
```

The first `pnpm test:e2e` run found P2-1904 (9 passed, 1 failed). The defect was fixed and the public browser suite reran successfully (10 passed). Expanding the connected suite to include the live Clinical Brief and doctor verification exposed P1-1907; after scoping the document limiter, the connected case passed through completion (1 passed), producing 11 unique browser cases overall. Both new focused API regressions passed, as did the 29 security cases, lint, and typecheck. The latest root suite passed 291 cases and skipped eight DB-only cases by design. Those eight passed in the original isolated PostgreSQL run, before the document-router fix; a post-fix full DB-backed root rerun remains to be performed.

## Exact reproduction sequence

1. Provision a dedicated local PostgreSQL database whose name begins with `helios_test`; set `TEST_DATABASE_URL` and `DATABASE_URL` to that target (for example, by copying `.env.test.example` to a local ignored configuration and replacing its credentials).
2. Run `pnpm --filter @helios/api exec prisma migrate deploy` with `DATABASE_URL` pointing only to that isolated database. The 16-migration fresh-install path was verified on PostgreSQL 18.
3. Run:

```powershell
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm test:integration
pnpm test:api
pnpm test:security
pnpm test:e2e
pnpm test:e2e:connected
pnpm test:load
pnpm test:coverage
pnpm test
```

Do not run seed/reset or load commands against production. The current load harness also rejects non-local hosts and non-allowlisted paths.

## Files changed in Phase 19

- `.env.test.example`
- `.env.example` (clarified credential placeholders after the existing-server check)
- `.env` (ignored local runtime configuration; not committed)
- `.gitignore`
- `README.md` (local database setup instructions)
- `package.json`
- `pnpm-lock.yaml`
- `apps/api/package.json`
- `apps/web/package.json`
- `apps/web/eslint.config.mjs`
- `apps/web/src/app/patient/page.tsx`
- `apps/api/tests/test-environment-guard.test.ts`
- `apps/api/tests/document-ai/api.test.ts`
- `apps/api/src/routes/documents.ts`
- `apps/api/prisma/migrations/20260910135000_verification_status_values/migration.sql`
- `playwright.config.ts`
- `tests/e2e/public-experience.spec.ts`
- `scripts/assert-test-environment.mjs`
- `scripts/load-smoke.mjs`
- `scripts/run-with-local-env.mjs`
- `scripts/run-with-demo-env.mjs`
- `playwright.connected.config.ts`
- `tests/e2e-connected/patient-doctor-connected.spec.ts`
- `docs/phase19-testing-report.md`

## Final status

**NOT READY**

All 310 unique currently runnable automated cases have passed across verified runs, including an earlier database integration run and a connected Hindi patient/doctor queue, Clinical Brief, verification, and completion lifecycle. The latest root run skipped eight DB-only cases without the isolated test connection; a post-fix full DB-backed rerun remains open. Synthetic demo seed/reset passes on `helios_sih_demo`. The final SIH acceptance gate still requires the complete clinical browser journey and an implemented/tested deterministic SafetyEngine, so HELIOS must not be presented as fully validated or ready for the final demonstration.
