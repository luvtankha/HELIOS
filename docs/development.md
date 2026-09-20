# Development guide

The repository is a strict-TypeScript pnpm workspace. `apps/web` contains Next.js routes/components/providers and API clients; `apps/api` contains Express route→controller→service→repository layers, domain engines and Prisma; `packages/shared` contains DTO/language contracts. Tests live beside web pages and under `apps/api/tests`/`tests/e2e*`; data/tooling lives in `dataset`/`scripts`.

Add HTTP input schemas under `apps/api/src/validation`; controllers translate transport, services own authorization/workflow, repositories own Prisma access, and serializers/DTOs prevent raw records from leaking. Keep optional providers behind narrow interfaces. Preserve original/provenance fields and explicit unknown/conflict states. Do not give model output authorization or doctor-verification authority.

Typical loop: copy `.env.example` to ignored `.env`, provision local PostgreSQL, `pnpm install`, `pnpm db:generate`, `pnpm db:migrate`, `pnpm dev`; before review run `pnpm typecheck`, `pnpm lint`, focused tests, `pnpm test`, and `pnpm build` in proportion to change. Use Prisma migrations for schema changes. Test data must be synthetic. Demo work uses only `demo:*` wrappers and `helios_sih_demo`; integration DB names must start `helios_test`.

Update [API](api.md), [database](database.md), configuration and limitations when contracts change. Comments should explain safety/authorization/provenance reasons, not restate syntax.
