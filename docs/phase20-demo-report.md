# Phase 20 — SIH demo mode implementation and verification

**Status: PARTIAL — not ready to claim a complete judge demonstration.** The new entry and presenter navigation are usable, but the Phase 20 full browser journey and a genuine SafetyEngine signal are not complete.

## Architecture and entry

- Entry: `/sih-demo` in the isolated local demo profile. It links to the real Patient App, real Doctor Dashboard sign-in, and `/doctor/sih-demo` presenter guide.
- Profile: existing `pnpm demo:*` wrapper forces a local `helios_sih_demo` PostgreSQL URL, private storage and explicit demo flags. The normal `helios` database remains separate.
- Presenter guide: rendered under the doctor route tree and its existing signed-session gate. The golden patient is looked up through the authenticated doctor dashboard API; no patient ID or clinical outcome is faked in the panel.
- Status: API/database readiness comes from `/api/v1/health`. It does not imply provider or clinical-feature readiness.
- Security at Phase 20: both demo paths were blocked outside explicit demo mode. Phase 21 subsequently added a protected reset endpoint; see `phase21-demo-reset.md`.

## Golden case and accounts

The existing deterministic Phase 17 seed supplies fictional **Aarav Sharma** (`DEMO-AARAV-024`), two visits, Hindi/Hinglish text, private synthetic documents, medications, allergy information, timeline inputs, comparison inputs, a prior verification and a queue entry. This phase reuses that seed; it does not introduce a competing generator. `demo.doctor` is the local demo doctor ID; the access code remains private in the ignored `.env`. There is no shared patient password. A newly created patient uses the normal signed patient session and consent workflow.

The seeded conflict and queue priority are demonstration review cues, **not** a SafetyEngine result. Phase 5 SafetyEngine is absent. The interface explicitly says so and never asserts a clinical alert or diagnosis.

## Presenter paths

- [Three-minute say/show/fallback guide](SIH_DEMO_SCRIPT.md)
- [Five-minute deep dive](sih-demo-deep-dive.md)
- Patient: real language → consent → details → complaint/interview → optional document → review → submit → token/waiting screens. The new entry merely navigates to these screens.
- Doctor: real sign-in → queue → patient workspace → Clinical Brief / What Changed / timeline / documents / verification → allowed consultation transitions. The new panel merely provides links and a live golden-patient lookup.
- Voice failure: use typed synthetic input through the same interview logic; never label it a recording.
- OCR failure: disclose the failure and show separately identified preseeded synthetic evidence; never attribute it to a failed live upload.
- Backend/database failure: show the unavailable readiness state and stop; never fabricate a successful clinical transition.

## Reset and production protection

Run `pnpm demo:reset` locally between judge sessions, then `pnpm demo:verify`. The guard rejects production, a non-local/non-demo PostgreSQL URL, missing explicit demo flags and any database containing non-demo patients. Phase 21 later added the designated demo-doctor/confirmation-protected browser reset and stricter post-reset validation; see `phase21-demo-reset.md` for the current behavior.

## Tests actually executed

- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm build` — passed with both dynamic demo routes and middleware included.
- `pnpm --filter @helios/api exec vitest run tests/demo-environment.test.ts` — 4/4 passed.
- `pnpm test:e2e:connected` — 2/2 passed against the real local synthetic database: entry/readiness/doctor auth/golden lookup, plus the connected Hindi queue/brief/verification/completion lifecycle. The latter test initiates patient intake through API calls, not all patient browser screens.
- Production-mode web server HTTP checks — `/sih-demo` 404, `/doctor/sih-demo` 404, normal `/patient` 200. No demo API mutation was attempted in production.
- `pnpm demo:reset` and `pnpm demo:verify` — golden dataset restored after E2E; counts recorded below.

## Golden reset counts

Expected verified baseline: 12 patients, 13 visits, 21 clinical facts, 3 documents, 9 timeline events, 5 conversations, 6 queue tokens, 1 verification, golden patient present. These are database query results, not UI counters.

## Acceptance boundary

| Requirement                                                                    | Result                                                                  |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Demo-only entry, isolated synthetic database, golden patient                   | Verified                                                                |
| Doctor-authenticated presenter navigation and live readiness                   | Verified                                                                |
| Guarded reset and production route protection                                  | Verified                                                                |
| Real token, queue synchronization, brief, doctor verification, completion      | Verified in connected test with API-driven patient intake               |
| Hindi/Hinglish text and rules fallback                                         | Available in existing implementation; full browser rehearsal still open |
| Live voice and live document upload/OCR in one browser journey                 | Not verified in Phase 20                                                |
| Full What Changed, timeline, conflict/evidence and doctor-note browser journey | Not verified end to end in Phase 20                                     |
| Deterministic SafetyEngine signal                                              | Unavailable — subsystem not implemented                                 |
| Three-minute and five-minute routes within target time                         | Scripts written; complete timed rehearsal not performed                 |

## Exact commands

```powershell
pnpm demo:migrate
pnpm demo:reset
pnpm demo:verify
pnpm demo:dev
pnpm test:e2e:connected
```

The final SIH demonstration must still be performed from patient browser intake through document processing and all doctor review tabs on the presentation machine. Do not mark Phase 20 complete or present HELIOS as clinically validated until those gates and a clinician-approved SafetyEngine are addressed.
