# HELIOS health check — 4 October 2026

The local native Hindi consultation and authenticated doctor handoff are operational. All four running services returned HTTP 200 after the final changes.

| Check | Result |
| --- | --- |
| TypeScript type checks and ESLint | Passed |
| Shared package, doctor API and Next.js production builds | Passed |
| API regression suite | 317 passed, 11 conditional tests skipped |
| Web component suite | 79 passed |
| Java unit tests and packaging | 48 passed, no failures |
| Python gateway/runtime suite | 27 passed |
| Isolated PostgreSQL integration suite | 18 passed, 1 optional Java handoff test skipped |
| Playwright browser suite | 13 passed |
| Actual Gemini native audio roundtrip | Passed; three synthetic Hindi spoken turns, five durable facts, identity, Hindi audio and completed intake |
| Authenticated doctor handoff | Passed; five facts, Internal Medicine routing, anonymous access denied |
| Automated accessibility | No serious/critical violations on patient entry, doctor login, or the authenticated native-intake workspace |

The actual native roundtrip received 128,640 audio bytes. Its ignored local report is `.local/live-roundtrip.json`; synthetic audio fixtures and patient records are labelled as synthetic. Browser tests additionally cover consent, speaking captions, listening state, renewed-ticket reconnect, clinician avatar handoff, completion, responsive layouts, and CSP.

## Changes verified

- Gemini Live receives microphone PCM directly and returns native audio. Structured tool calls log English/Roman Hinglish facts independently of Hindi speech captions.
- Server policy asks contextual follow-ups, retains unknown/conflicting answers, and selects a specialization and available matching doctor.
- The doctor workspace displays live facts, provenance and routing. The clinical brief now uses those facts, refreshes stale generated summaries, and retains evidence references.
- Doctor passwords use salted scrypt hashes and work with demo mode disabled.
- Missing Tailwind color scales and low-contrast dashboard tab labels were repaired. The patient view has five clinicians, an active central clinician, a speech bubble and listening state.
- Audio buffering uses a fixed-size accumulator; matching and grouping use Sets/Maps to avoid repeated scans/copies. Reconnects and buffers are bounded; SDK clients, audio nodes and microphone tracks are released.
- The live route adds 8.99 kB of route JavaScript, with 102 kB shared initial Next.js code. These are build sizes, not a measured before/after latency comparison.

## Running locally

Open `http://localhost:3000/patient` or `http://localhost:3000/doctor/login`. Doctor ID is `helios-local`; its access code is `DOCTOR_DEMO_ACCESS_CODE` in the ignored private `.env`. Credentials are not included in this report.

`pnpm dev` (also `pnpm dev:v2`) starts the complete development stack. See the root README for prerequisites and provisioning. The current local stack is already running, so do not launch another copy on the same ports.

The retained local database is `.local/postgres` on port 55435. The temporary validation database on port 55434 was stopped and moved to `../items to be deleted/native-voice-validation-postgres` for manual deletion.

## Scope of verification

The configured local doctor accepts Internal Medicine referrals. Other specialties need a clinic roster; an unmatched referral is saved awaiting assignment. Docker is not installed here, so the Compose deployment has not been executed. Free-tier availability depends on the Gemini project's quota and billing settings, which the application cannot verify from an API key. These checks establish software behavior, not clinical validation across all symptoms, accents or physical microphone conditions.
