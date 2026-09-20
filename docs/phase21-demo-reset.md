# Phase 21 — SIH demo reset

## Outcome and entry points

The protected presenter page at `/doctor/sih-demo` now has **Reset Demo** with a confirmation step. It calls `POST /api/v1/demo/reset` using the existing signed doctor-session token. The endpoint runs the existing guarded `demo:reset:direct` pipeline (fixture generation → demo-only cleanup → deterministic seed → verification), then runs an additional strict `validateDemoState()` check before returning `READY`. The presenter remains signed in. CLI recovery remains `pnpm demo:reset`.

The response carries only environment, scenario, reset ID, state, elapsed milliseconds, and non-PHI validation checks/counts. Success and failure are written to `AuditLog` without passwords, tokens or clinical content. A concurrent request is rejected with 409 in the API process.

## Isolation and authorization

The API checks, before invoking any destructive step: non-production `NODE_ENV`, `ALLOW_DEMO_SEED=true`, `DEMO_MODE=true`, `ENABLE_DEMO_MODE=true`, a local PostgreSQL URL naming a demo database, the actual PostgreSQL `current_database()` matching that URL, an unexpired signed doctor token, and the active seeded `demo.doctor` account. Neither patient tokens nor another doctor account can reset the demo. The CLI independently repeats the environment/database guard and refuses a database containing non-`DEMO-` patients. Production-block API tests verified **zero database calls and zero runner calls**.

The isolated database is `helios_sih_demo`; demo records have stable IDs and synthetic patient codes. The reset script deletes only those patient-linked records, demo queue entries/events/counters and `demo.*` users. It preserves audit logs and does not touch other databases. File cleanup is restricted to the resolved `demo-synthetic` subdirectory under configured `STORAGE_PATH`; then synthetic document fixtures are regenerated. It does not delete arbitrary uploads or audio. The fixture pipeline retains its fixed synthetic audio assets.

## Deterministic baseline and validation

The seed restores 12 patients, 13 visits, 3 documents, 9 timeline events, 5 interview responses, 6 queue entries and 1 verification. Aarav (`demo-patient-aarav`) has two visits, source-linked documents/timeline inputs, and queue entry `demo-queue-aarav`: token **A-001**, sequence 1, WAITING. The six token values are A-001 through A-006; counter A resumes at 7 and is unpaused. The Phase 21 prompt's A-024 value was illustrative, not the repository's actual seed.

`validateDemoState()` checks exact global counts, golden patient/visits/documents/timeline, interviews, verification, queue uniqueness and token/status/visit/counter references, and rejects non-demo patients. `READY` means this **supported synthetic baseline** passed; it is not a claim that the missing SafetyEngine or every Phase 21 acceptance criterion is complete. An invalid check yields `DEMO_RESET_FAILED`, never `READY`. The original CLI verifier also invokes this strict validator. The API's database cleanup is transactional; fixture/file restoration and seeding are separate operations, so a mid-pipeline failure can leave an incomplete demo. The response is 503 and the supported recovery path is to rerun `pnpm demo:reset`, then `pnpm demo:verify` before presenting. There is no cross-file/database rollback snapshot.

## Client state and live updates

The presenter refreshes Aarav's authorized doctor queue data after success and keeps doctor authentication. Doctor queue pages already poll live backend state. Patient demo tabs on the same origin receive a local-storage reset signal. Separately isolated browser contexts poll a non-PHI `GET /api/v1/demo/state` reset generation every eight seconds; when it changes, stale patient session/draft/token storage is cleared and the tab returns to `/patient/language`. The demo-state endpoint is unavailable outside explicit demo mode. There is no shared Redis/clinical cache to flush or WebSocket/SSE channel; the mechanisms are existing polling plus the new reset generation signal. The Phase 20 presenter sequence is navigation-only, so returning to its starting page resets no separate orchestration state machine.

## Evidence and performance

- API/web TypeScript checks passed.
- `tests/demo-reset.test.ts` and `tests/demo-environment.test.ts`: 11 passed, including production POST (zero database/runner calls), demo-flag/database/auth blocks, actual database identity mismatch, simulated runner failure, and concurrent request rejection.
- Live API reset returned `READY` with every strict invariant true. The first cold reset measured **22,786 ms** server-side; a second reset after changing Aarav's queue status to CALLED restored WAITING and measured **6,577 ms**.
- Connected Chromium suite passed twice (2 tests per run): the protected browser Reset Demo action returned success, a separate patient browser context cleared its stale token after the generation changed, and a fresh Hindi patient completed a doctor queue journey after reset.

## Remaining limitations

The repository has no implemented Phase 5 SafetyEngine. The validator reports `safetyEngine: UNAVAILABLE`; it cannot truthfully validate or restore a rule-derived safety scenario. The seed's priority-review badge is not a safety-engine output. The strict validator checks demo entity counts and key references, not every possible orphan across all tables. Atomicity across PostgreSQL, filesystem and seed process is unavailable. Cross-process reset serialization is not implemented (the demo server is single-process). A full two-run SIH demonstration including voice, OCR, What Changed, verification and a SafetyEngine trigger has **not** been completed; Phase 21's full acceptance criteria therefore remain partial.

## Files changed

`apps/api/src/demo/demo-guard.ts`, `apps/api/prisma/demo-guard.ts`, `apps/api/src/demo/validate-demo-state.ts`, `apps/api/scripts/verify-demo.ts`, `apps/api/src/demo/demo-reset-service.ts`, `apps/api/src/routes/demo-reset.ts`, `apps/api/src/app.ts`, `apps/api/tests/demo-reset.test.ts`, `apps/web/src/services/doctor-dashboard.ts`, `apps/web/src/app/doctor/sih-demo/presenter-panel.tsx`, `apps/web/src/providers/patient-flow-provider.tsx`, `tests/e2e-connected/demo-entry.spec.ts`, this document.
