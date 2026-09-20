# Testing and verified scope

The latest repair and verification record is [September 15 bug fixes](bugfix-verification-2026-09-15.md). Earlier measurements below remain historical. Current standard commands are:

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Specialized commands: `pnpm test:unit`, `pnpm test:api`, `pnpm test:security`, `pnpm test:a11y`, `pnpm test:responsive`, `pnpm test:performance`, `pnpm test:coverage`, and guarded `pnpm test:e2e:connected`. Run `pnpm test:db` to migrate and test the isolated `helios_test_regression` schema on the local configured database. Direct integration runs require a local `TEST_DATABASE_URL` named/schema-prefixed `helios_test`; the guard rejects production and remote targets. The connected suite resets `helios_sih_demo` and must never target real records. For real voice coverage, install the local speech model with `pnpm speech:setup` and set `SPEECH_PROVIDER=local`; the real-recording scenario explicitly skips other providers.

Phase 19 recorded 310 unique cases passing: 266 API/backend Vitest, 33 web Vitest, and 11 Playwright, plus 40/40 local load-smoke requests. Those are historical measurements, not a current cumulative total. In this Phase 22 audit, root `pnpm test` passed **265 API + 33 web** cases; **8 isolated-database cases skipped** because `TEST_DATABASE_URL` was not configured for this run. They passed in Phase 19's dedicated database run. Focused reset/environment tests passed 11 cases. The connected browser command passed 2 scenarios after a navigation-aware test assertion was fixed. Fresh `pnpm test:coverage` reported API **56.57% statements / 57.61% lines** and web **53.51% statements / 55.98% lines**; coverage percentages changed as the codebase grew. Counts overlap across commands and should not be summed.

Fresh specialized results: unit 80 API + 33 web passed; API-focused 46 passed; security 29 passed; accessibility 2 passed; responsive 7 passed; performance 1 passed (one local page sample: response end 12 ms, DOM content loaded 43 ms, load 141 ms). These do not establish clinical or deployed performance assurance.

Limitations: no SafetyEngine exists to test; live OpenAI STT/NLU is not certified; document comparison coverage is not exhaustive. The connected Chromium suite now covers real local voice → interview → local PDF → submission → doctor review, plus consultation lifecycle. This is not all-browser or physical-microphone certification. Local timing/load samples are not capacity claims; automated tests are not a penetration test, accessibility certification, clinical validation, or production-readiness proof.

Specialization-routing coverage includes deterministic unit cases for representative specialty matches, aliases/fuzzy wording, explicit negation, historical-only emergency wording, pediatric and co-morbidity alternatives, vague/competing input, emergency precedence, and existing high-risk signals. API tests verify signed session proof, strict query/body validation, and doctor-proofed audit access. The PostgreSQL integration suite seeds the versioned dataset, persists a decision, then proves a patient-selected existing doctor is assigned through the normal queue transaction. The connected browser journey also selects the routed doctor before submission. See [specialization routing](specialization-routing.md); these checks remain software tests, not clinical validation.
