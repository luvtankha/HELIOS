# HELIOS repair and verification — September 15, 2026

## Scope

Repair reproducible failures in the existing local HELIOS implementation, especially voice intake, and exercise the patient-to-doctor path. This is not a claim that every possible defect has been eliminated or that HELIOS is a validated medical device.

## Repairs

- Replaced the active canned speech provider with a real local multilingual faster-whisper small model. Installed an isolated Python environment and model under ignored `work/` paths. Added `pnpm speech:setup` and `pnpm speech:smoke` for repeatable setup/verification. Audio is passed in memory over stdin; no external speech API key is needed.
- Added local-provider setup checks, bounded concurrency, timeout/worker termination, output validation, silence rejection, decoded-duration checks, and actionable errors instead of a fabricated transcript.
- Reworked browser recording cleanup: cancel and navigation release media tracks, delayed permission cannot restart a canceled recording, duplicate starts are ignored, upload cancellation propagates, and waveform failure does not disable recording. Empty/oversized audio and recorder errors recover to typing/retry.
- Allowed adequate time for local CPU transcription. Transcript edit/confirm failures retain the text and offer retry. Downstream failure no longer prematurely marks the voice interaction complete.
- Fixed patient interview refresh initialization, restoration of language/details, latest complaint retention, stale data carried into a new session, and premature submitted state after failed submission.
- Added validation for malformed browser drafts so null/wrong-shaped saved values do not replace required patient state.
- Made negative multi-select answers exclusive, corrected review back/edit navigation, and aligned typed/voice complaint bounds at 2–4,000 characters.
- Activated local document OCR in this installation. Allowed private blob iframe previews in CSP while retaining anti-embedding and object restrictions. Released document object URLs when asynchronous loads finish after navigation.
- Added a guarded database-test runner using only the isolated `helios_test_regression` schema. Normal public-schema patient data is not cleared by this runner. Connected tests explicitly reset the synthetic `helios_sih_demo` database.

## Tests and evidence

- Type checking and lint: passed.
- Final production build and public Chromium suite: 11 passed (seven responsive viewports, two accessibility scans, one navigation timing sample, one private-preview security-header regression). Measured sample: response end 4 ms, DOM content loaded 59 ms, load 98 ms; not a capacity guarantee.
- Backend Vitest: 275 passed; 8 database-only tests intentionally skip in the ordinary unit run and are exercised by the dedicated database suite.
- Frontend Vitest: 46 passed, covering components, state recovery, recording lifecycle, document cleanup and existing flows.
- Real PostgreSQL integration: 16 passed across four files; all 16 migrations present, none pending in the isolated test schema. Counts overlap other suites and must not be summed as unique cases.
- Connected Chromium: all three final scenarios passed. Real recorded English audio → local speech worker → transcript review/edit and simulated transient-edit failure recovery → adaptive interview → page refresh → PDF upload/local processing → submission/token → doctor review and live patient waiting status. A separate Hindi patient scenario verifies doctor verification history and call/start/complete consultation transitions. The demo-entry scenario checks presenter access separation. A previous rerun exceeded a five-second doctor-navigation assertion; the test now waits explicitly for the destination URL before checking its contents.
- Real speech smoke: the generated English recording was recognized as “I have had a fever and a headache for three days.” Measured standalone inference was about 5–6.3 seconds on this machine. A 15-second Hindi reference excerpt also produced Devanagari text; that is a functionality check, not an accuracy benchmark.
- Locale validation: 43 English and 43 Hindi keys, no missing/extra keys or placeholder mismatches.
- Synthetic dataset validation: passed, including 1,000 patients, 3,000 visits and 15,000 clinical facts.
- Prisma schema validation: passed.
- Final running-service checks: demo entry, patient entry and doctor login returned HTTP 200; API health returned API up / database up. Local development-server load smoke: 40 requests at concurrency five, zero failures, p50 304 ms and p95 372 ms. This is a small local smoke test, not production capacity validation.
- Security regression suite: 29 passed (overlaps backend totals).
- Local image OCR smoke: passed on a generated synthetic lab report, including report type and hemoglobin extraction.
- Coverage command: passed. API statement/line coverage: 56.97% / 58.04%; web: 57.99% / 60.31%. Coverage is partial and does not include all connected browser execution; see generated local coverage reports for uncovered paths.

## Running and using voice

From the project directory run `pnpm demo:dev`. Open `http://localhost:3000/sih-demo`, or patient intake at `http://localhost:3000/patient`. Doctor login is `http://localhost:3000/doctor/login`. The demo wrapper uses the separate synthetic database. Doctor credentials stay in local configuration, not this report.

Allow microphone access, select English or Hindi, record a short clear complaint, stop, and wait for transcription. Review/correct every transcript before accepting. Use localhost on this computer or HTTPS when deploying; plain HTTP on a LAN IP generally does not permit microphone capture. If browser permission was denied, restore it in the browser's site settings. Typed intake remains available.

## Remaining boundaries

Chromium automation uses a generated audio file through a simulated microphone, but the real MediaRecorder, upload, backend and local model execute. It cannot prove that the user's physical microphone, OS permissions, every browser/device, all accents or noisy-room conditions work. OpenAI adapters were not live-tested because this installation uses local providers. Local OCR remains heuristic; scanned PDFs/handwriting and exhaustive document comparison are not certified. The existing project has no implemented SafetyEngine, production identity provider or clinical validation. Those are documented product limitations, not newly implemented capabilities. No claim of zero crashes under all conditions, production readiness or clinical safety is made.
