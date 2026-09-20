# Phase 18 — UI/UX implementation report

## Outcome

Phase 18 improves the existing HELIOS frontend without changing backend business rules, clinical engines, provenance, authorization, document access, or queue semantics. It is a substantial product polish pass, but it is not truthfully complete end-to-end: PostgreSQL and the API were unavailable during runtime inspection, so authenticated workflow screens could not be exercised with Phase 17 records. Phase 5 SafetyEngine is still absent, as recorded in the Phase 17 report.

## Design system and branding

- Added semantic CSS tokens for the navy/teal healthcare palette, surfaces, borders, states, spacing, radii, input/touch heights, motion, and restrained shadows.
- Added reusable `helios-card`, `helios-field`, `helios-button-primary`, and `helios-eyebrow` primitives.
- Replaced mixed serif display styling with a readable system sans-serif stack including Devanagari-capable Windows fonts.
- Added a reusable HELIOS brand mark and matching SVG application icon.
- Retained reduced-motion behavior, strengthened visible focus treatment, and kept minimum patient touch targets at approximately 44–56 px.

## Patient experience

- Simplified landing copy around the pre-consultation purpose and made the primary action “Start check-in.”
- Added native Hindi landing copy and corrected the remaining Hindi-mode eyebrow and resume action.
- Language selection now shows only English and हिन्दी; unsupported registry languages are not presented as disabled product options.
- Reworked consent into four short, numbered explanations while preserving the backend consent action.
- Replaced adaptive percentage emphasis with a calmer stage/status treatment because question counts can change.
- Reduced the interview microphone footprint so the current question remains visually dominant.
- Added explicit voice state language for permission, stopping, uploading, transcription and preparation; patient-facing failures do not display provider messages.
- Split document intake into Take a photo, Choose a photo, and Upload a PDF or file.
- Strengthened token readability and the called-patient state while preserving authenticated queue polling and avoiding patient names on waiting status.
- Reworded high-traffic errors to safe recovery messages; locally entered information is explicitly described as retained on the device.

## Doctor experience

- Removed inactive Messages, Reports, Knowledge Base, AYUSH and Settings items from the global navigation. Navigation now exposes only Dashboard, Patients, Today’s Queue and Verification; patient-specific AYUSH remains in the patient workspace.
- Tightened the doctor shell for clinical density and converted its narrow layout into a horizontally scrollable navigation rather than a compressed desktop sidebar.
- Simplified dashboard metrics into one operational summary surface, kept Today’s Queue dominant, and retained debounced patient search.
- Removed the hard-coded demo access code from the login form. Demo credentials remain operator-provided and server-checked.
- Added explicit previous/current values and source labels to the embedded What Changed view.
- Preserved severity-aware safety styling: controlled red is used only when the API reports HIGH; queue priority is not relabeled as a diagnosis.
- Improved document preview loading and retry states. The evidence dialog supports Escape-to-close, uses a responsive original/extraction split, and no longer exposes raw bounding coordinates.

## Accessibility, responsiveness and performance

- Added application icon semantics, dialog Escape behavior, tab-panel linkage, live/status announcements, safe loading labels and improved focus styling.
- Avoided a new icon, animation, font, state-management or component library; bundle impact is limited to local components and CSS.
- Corrected a real development-runtime package-resolution failure found during visual QA. Root `pnpm dev` now builds the shared package first; Next resolves the shared package’s `.js` specifiers to TypeScript sources when needed.
- Production build reports shared first-load JavaScript of 102 kB; the largest new affected route remains the existing patient documents page at approximately 119 kB first load.

## Manual inspection performed

The production-rendered patient landing screen was visually inspected at 375 px and 768 px, including Hindi/Devanagari wrapping; no horizontal overflow was present. The doctor login was inspected at 375 px and 1440 px, with its credential field empty and no horizontal overflow at 375 px. Accessibility trees confirmed the headings, controls and form labels on both screens. The initial development inspection also discovered and verified the shared-package startup fix.

Authenticated patient intake, voice permission/recording, token transitions, doctor dashboard, queue actions, patient workspace, evidence viewer, timeline and verification were **not** manually inspected against live data. They require the unavailable API/PostgreSQL demo environment. Therefore the requested 375/768/1024/1280/1440/1920 screen-by-screen matrix and the golden journey are outstanding and must not be marked complete.

## Automated validation

- `pnpm lint` — passed.
- `pnpm typecheck` — passed.
- `pnpm --filter @helios/web test` — 14 files, 33 tests passed after updating intended copy assertions.
- Full `pnpm test` — passed: 253 API tests and 33 web tests; 8 database-dependent API tests remained skipped.
- `pnpm build` — passed; 23 Next.js routes generated.

## Important modified files

`apps/web/src/styles/tokens.css`, `apps/web/src/app/globals.css`, `apps/web/src/app/icon.svg`, `apps/web/src/components/ui/brand-mark.tsx`, patient shell/controls/feedback/voice components, patient landing/language/consent/interview/listening/waiting pages, doctor shell/dashboard/login/patient workspace/queue components, document upload/preview/evidence components, related UI tests, `apps/web/next.config.ts`, `packages/shared/package.json`, and root `package.json`.

## Run commands

For ordinary local development: `pnpm dev`.

For the isolated synthetic demo, create the private environment file described in `docs/demo-script.md`, then run:

```powershell
node --env-file=.env.sih-demo.local --run db:migrate
node --env-file=.env.sih-demo.local --run demo:reset
node --env-file=.env.sih-demo.local --run dev
```

After PostgreSQL is available, execute the complete Phase 17 golden journey and repeat visual checks at all six required widths before claiming Phase 18 complete.
