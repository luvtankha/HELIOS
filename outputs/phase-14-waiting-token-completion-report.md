# Phase 14 — Waiting / Token Management completion report

## 1. Files created/modified

Created the Phase 14 migration, queue repository/service/router, notification abstraction, queue tests, patient waiting page, doctor operational queue/full page, queue architecture guide, and this handoff documentation. Modified the Prisma schema/seed, API composition, patient submission service/controller/client/provider, shared DTOs, doctor dashboard/shell, patient completion page, README, and affected tests.

Principal files:

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260914090000_waiting_tokens/migration.sql`
- `apps/api/prisma/seed.ts`
- `apps/api/src/queue/queue-repository.ts`
- `apps/api/src/queue/queue-service.ts`
- `apps/api/src/queue/notification-provider.ts`
- `apps/api/src/routes/queue.ts`
- `apps/api/src/app.ts`
- `apps/web/src/app/patient/waiting/page.tsx`
- `apps/web/src/components/doctor/operational-queue.tsx`
- `apps/web/src/app/doctor/queue/page.tsx`
- `apps/web/src/services/queue.ts`
- `packages/shared/src/index.ts`
- `docs/queue/architecture.md`
- `outputs/HELIOS-PHASE-14-WAITING-TOKEN-SYSTEM.txt`

## 2. Database changes

Added `QueueCounter`, `QueueEntry`, `QueueEvent`, `QueueStatus`, and `QueuePriority`. Added existing-model relations from User, PatientProfile, and Visit. `QueueEntry.visitId` and `queueKey + queueDate + sequence` are unique. The old global unique constraint on `Visit.tokenNumber` was removed because token text can repeat on a different queue/day. Queue entries retain the visit reference as the idempotency boundary.

## 3. API changes

Added signed patient check-in/own-status endpoints and signed doctor list, Call Next, pause/resume, and named token-action endpoints under `/api/v1`. Patient submit now requires its session token and assigns/reuses a token through QueueService.

## 4. Token state machine

Allowed paths are `WAITING -> CALLED/CANCELLED/NO_SHOW/SKIPPED`, `CALLED -> WAITING/IN_CONSULTATION/NO_SHOW/SKIPPED`, and `IN_CONSULTATION -> COMPLETED`. Recall is a separately audited CALLED-to-CALLED command. Terminal states reject further transitions.

## 5. Queue algorithm

Daily sequences come from atomic `QueueCounter` upsert/increment inside a serializable transaction. Call Next uses deterministic selection and a WAITING compare-and-set inside a serializable transaction, with retry on serialization/uniqueness contention.

## 6. Priority logic

Stored `PRIORITY_REVIEW` entries precede normal entries, then creation time and ID break ties. A qualifying priority is derived only from an existing open/acknowledged HIGH stored signal excluding the future-demo placeholder. It is an attention label, not a diagnosis. No LLM participates.

## 7. Real-time mechanism

Patient and doctor clients poll every eight seconds while visible. `QueueNotificationProvider` provides the extension seam; the in-app implementation relies on persisted status as the source of truth. Network failure preserves the last confirmed UI state and displays an error.

## 8. Security/RBAC

Patient identity comes only from the signed session credential. Doctor identity/role comes only from the signed doctor credential plus active User lookup. Non-admin doctor reads/actions require active patient assignment. Frontend-supplied patientId, doctorId, or role cannot widen access. Queue transitions are named, validated, authorized, compare-and-set, and audited.

## 9. Tests executed

Passed strict TypeScript checks, lint, formatting, Prisma schema/client validation, production build, 227 API tests, and 33 web tests. Eight PostgreSQL-gated tests were skipped because this machine reports `Database: not_configured`; three of those are the Phase 14 transaction tests. The `TEST_DATABASE_URL`-gated Phase 14 suite exists for real atomic token allocation, duplicate submission, concurrent Call Next, and audit persistence, but those database assertions are not claimed as executed live.

## 10. Demo instructions

Configure PostgreSQL, migrate, and seed. Start HELIOS, complete and submit a patient intake, then open `/patient/waiting`. Sign into `/doctor` as `demo.doctor`, Call Next, and watch the patient state update. Continue with Start Consultation and Complete. The seed also supplies three dated synthetic queue entries.

## 11. Run commands

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Validation:

```bash
pnpm typecheck
pnpm lint
pnpm db:validate
pnpm test
pnpm build
```

Live transaction integration after migrating a disposable test database:

```bash
TEST_DATABASE_URL=postgresql://... pnpm --filter @helios/api test
```

## 12. Remaining TODOs

- Execute migration, seed, and database-gated contention tests against a configured PostgreSQL test instance.
- Add clinic/department/room configuration and corresponding doctor/date filters when those entities exist.
- Add production identity, clinic tenancy, and admin configuration.
- Optionally add a token-only public waiting-room display.
- Optionally replace polling with SSE/WebSocket and add SMS/push providers.
- Tune wait estimates from authorized operational history.
- Implement the separately scoped Phase 5 SafetyEngine; Phase 14 does not claim one.
