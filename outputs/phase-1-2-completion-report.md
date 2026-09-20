# HELIOS Phase 1–2 Completion Report

Date: September 8, 2026

## 1. Architecture implemented

HELIOS is organized as a pnpm monorepo with a Next.js patient web application, an Express API, a shared TypeScript package, and Prisma/PostgreSQL persistence. The implementation keeps routing, controllers, services, repositories, validation, serialization, and database access separated. Patient-flow writes that touch multiple records use Prisma transactions.

## 2. Database models added

The Prisma domain includes `SystemConfig`, `User`, `PatientProfile`, `PatientSession`, `Visit`, `ClinicalHistory`, `Symptom`, `Medication`, `Allergy`, `MedicalDocument`, `DocumentExtraction`, `TimelineEvent`, `RiskSignal`, `DoctorVerification`, `ConsentRecord`, and `AuditLog`, plus supporting enums, relations, indexes, uniqueness rules, and database checks.

The schema intentionally allows a patient session and consent record to exist before a patient profile, matching the consent-first onboarding flow. Patient age is stored instead of date of birth to reduce unnecessary personal data collection.

## 3. Migration status

An incremental migration was generated at `apps/api/prisma/migrations/20260908010000_domain_foundation/migration.sql`. Prisma schema validation and client generation pass.

The migration was not applied in this environment. No PostgreSQL server, container runtime, `psql`, `DATABASE_URL`, or `TEST_DATABASE_URL` was available. A deployment attempt against `localhost:5432` correctly failed because no database was listening. The migration must therefore be applied once a real PostgreSQL instance is configured.

## 4. Seed data status

`apps/api/prisma/seed.ts` contains clearly synthetic patients Aarav Sharma (24), Priya Patel (32), and Rohan Verma (45). Aarav includes a current and previous visit plus synthetic medication, allergy, timeline, document, risk, and doctor-verification records. Seed operations are idempotent where practical.

The seed is type-checked and ready, but it was not executed successfully because PostgreSQL is unavailable in this environment.

## 5. Backend endpoints added

- `GET /api/v1/patients`
- `POST /api/v1/patients`
- `GET /api/v1/patients/:id`
- `POST /api/v1/patient-sessions`
- `GET /api/v1/patient-sessions/:id`
- `PATCH /api/v1/patient-sessions/:id/progress`
- `POST /api/v1/patient-sessions/:id/submit`
- `POST /api/v1/consents`
- `POST /api/v1/visits`
- `GET /api/v1/visits/:id`
- `PATCH /api/v1/visits/:id/complaint`

Existing health endpoints remain available. When the database is not configured, persistence endpoints return the standard structured `503 DATABASE_NOT_CONFIGURED` response rather than crashing.

## 6. Validation and API behavior

The API validates sessions, progress updates, consent, patient details, visits, and complaint text with human-readable errors. Responses use explicit DTO serializers so raw Prisma records are not exposed. Unknown draft properties are removed before patient-session data is returned.

## 7. Patient-facing routes added

- `/patient` — welcome and start/resume entry
- `/patient/language` — language selection
- `/patient/consent` — informed consent gate
- `/patient/details` — name, age, gender, and optional phone
- `/patient/complaint` — text complaint entry and voice path
- `/patient/listening` — simulated listening, processing, transcript, and follow-up questions
- `/patient/review` — review, edit, and submit
- `/patient/complete` — visit token and next steps
- `/doctor-coming-soon` — explicit Phase 3 placeholder

The landing page routes Patient to the implemented flow and Doctor to the coming-soon page.

## 8. Components and state management

Reusable patient UI includes a patient shell, controls, voice states, feedback states, progress indicator, and original inline SVG welcome illustration. `PatientFlowProvider` coordinates backend identifiers and the current step, persists resumable identifiers in local storage, and keeps temporary sensitive form drafts in session storage. Route guards verify resumable sessions through the API and redirect invalid sessions safely.

## 9. Language and accessibility behavior

English and Hindi can be selected. Tamil and Bengali are shown as coming soon. The patient interface uses large touch targets, explicit labels, high-contrast status feedback, keyboard-compatible native controls, responsive layouts, and reduced-motion handling.

## 10. Voice and interview scope

The Phase 2 voice interaction is a clearly simulated experience with `LISTENING`, `PROCESSING`, and `RESULT` states, a demo transcript, retry/edit/accept controls, and mock follow-up questions for location, duration, and vomiting. Text entry remains a fully usable alternative. No medical advice or diagnosis is produced.

## 11. Tests added and results

Automated coverage includes API flow behavior, repositories, database integration scaffolding, patient welcome and language pages, consent gating, form validation, review/submission, resume behavior, and API failure handling.

- API: 19 passed, 4 skipped
- Web: 8 passed
- Total: 27 passed, 4 skipped

The four skipped tests require a live `TEST_DATABASE_URL`; they cover real PostgreSQL integration and are designed to run when that variable is present.

## 12. Quality and build verification

- Prettier formatting check: passed
- ESLint: passed
- Strict TypeScript checks, including seed/config/scripts: passed
- Prisma schema validation: passed
- Prisma client generation: passed
- Production build: passed; 13 pages generated
- Manual route smoke test: all requested patient and doctor-placeholder routes returned HTTP 200
- Manual API smoke test: health returned API-up/database-not-configured; patient-session creation returned the expected structured 503 without a database
- Visual QA: desktop and tablet layouts were inspected; at 320 px there was no horizontal overflow, no browser console error, and no button or link below the 44 px touch-target threshold

## 13. Files and documentation changed

The principal additions and updates are under:

- `apps/api/prisma/` — schema, incremental migration, seed, and Prisma configuration
- `apps/api/src/controllers/`, `repositories/`, `routes/`, `serializers/`, `services/`, and `validation/`
- `apps/api/test/` — API, repository, and conditional database integration tests
- `apps/web/app/patient/` and `apps/web/app/doctor-coming-soon/`
- `apps/web/components/patient/`, `providers/`, `services/`, and tests
- `packages/shared/src/index.ts` — shared domain DTOs and enums
- `README.md`, `docs/architecture.md`, `docs/product-flow.md`, and `docs/domain-model.md`

## 14. Known issues, postponed work, and exact run steps

Known environment limitation: end-to-end persistence, migration application, seed execution, and live database assertions cannot be verified until PostgreSQL is available. The implementation and local non-database checks are complete, but Phase 1 should not be considered operationally accepted until those database commands succeed.

Intentionally postponed beyond Phase 2: doctor authentication and dashboard, clinical decision support, real speech recognition, production document ingestion/OCR, real extraction pipelines, operational risk scoring, external integrations, notifications, production deployment, and other Phase 3+ work.

Run from the repository root in PowerShell:

```powershell
Copy-Item .env.example .env
# Edit .env so DATABASE_URL points to a running PostgreSQL database.
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Then open `http://localhost:3000/patient`. The API defaults to `http://localhost:4000`; health is available at `http://localhost:4000/api/v1/health`.

For the complete quality gate:

```powershell
pnpm format:check
pnpm db:validate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

To run the four live database integration tests, set `TEST_DATABASE_URL` to an isolated PostgreSQL database before running the API tests.
