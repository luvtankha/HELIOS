# HELIOS v2 Phase 2 — reproducible v1 baseline

Baseline commit: `0db0c818dc9c895d0fb537e7af3a98d86260287b` (`main`).

Local migration safety point: tag `helios-v1-baseline-2026-10-04` points to the baseline commit, and implementation documentation/work continues on local branch `helios-v2`. Nothing has been pushed by this migration work.

This phase establishes the pre-migration behavior/checks that later phases must continue to satisfy or intentionally replace. No patient runtime behavior, database schema, or doctor-dashboard code was changed.

## Local toolchain observed

| Tool | Observed | Baseline note |
| --- | --- | --- |
| Node.js | `v24.19.0` | Repository documents Node 20.12+; current checks pass on this newer local runtime. |
| pnpm | `11.19.0` | Matches repository `packageManager`. PowerShell blocks `pnpm.ps1`, so commands in this workspace use `pnpm.cmd`. |
| Python | not installed / not on PATH | Local faster-whisper and future Python AI service cannot be executed in this workspace until Python is provisioned. |
| Java | `27` | A Java runtime is present, but target HELIOS v2 is Java 21. A Java 21 toolchain must be provisioned or a build toolchain configured to compile/test against Java 21 before Spring Boot implementation is accepted. |
| PostgreSQL config | no root `.env` present | No local database credentials were supplied in this clone. Database integration suites therefore remain intentionally skipped/unrun. |

## Dependency/bootstrap sequence

Fresh-clone sequence proven in this workspace:

```text
pnpm.cmd install --frozen-lockfile
pnpm.cmd db:generate
```

`db:generate` is required before API typechecking because Prisma-generated types are not present immediately after the fresh clone/install in this environment.

## Baseline checks

| Check | Result | Evidence / note |
| --- | --- | --- |
| `pnpm.cmd install --frozen-lockfile` | PASS | 674 packages linked from the pnpm store; lockfile unchanged. |
| `pnpm.cmd db:generate` | PASS | Prisma Client 6.19.3 generated from the checked-in schema. |
| `pnpm.cmd typecheck` | PASS after Prisma generation | Shared, API and web TypeScript checks pass. |
| `pnpm.cmd lint` | PASS | Shared, API and web lint pass. |
| `pnpm.cmd build` | PASS | Shared + API TypeScript build and Next.js production build succeed; 23 static/dynamic app routes generated. |
| `pnpm.cmd test:unit` | PASS after shared package build exists | API: 91/91 selected unit tests; web: 66/66 component tests. |
| `pnpm.cmd test` | PASS | API: 312 passed, 10 database integration tests skipped; web: 66 passed. |
| Database integration suite | BLOCKED BY ENVIRONMENT | No `.env`/local PostgreSQL test credentials. Do not fabricate credentials or point tests at an unknown database. |
| Local real speech smoke | BLOCKED BY ENVIRONMENT | Python is absent and the ignored local speech model/venv are not present in this fresh clone. |

### Fresh-clone ordering observation

An initial `typecheck` before `db:generate` failed because `@prisma/client` generated types were absent. An initial `test:unit` before building `@helios/shared` failed to resolve the package entry. After the documented bootstrap/build sequence, the same checks pass. These are bootstrap-order observations, not HELIOS source regressions.

## Regression baseline that v2 must preserve

The passing suite confirms useful pre-migration behavior around:

- patient session ownership and flow state;
- current adaptive interview rules, conflict/unknown handling and clinical NLU boundaries;
- specialization routing engine and API behavior;
- voice upload/transcription service validation and ownership;
- document validation/extraction behavior;
- timeline, comparison and clinical brief generation;
- queue service behavior;
- authorization/security failure cases;
- patient frontend session, interview, voice, document, waiting and routing components;
- existing doctor-dashboard tests (baseline only; doctor code remains out of change scope).

When a v2 capability intentionally replaces an old patient behavior (for example the tap-to-record voice flow), the old test is not deleted first. A new v2 acceptance/contract test must cover the replacement, then the obsolete test/code can be removed at the cleanup gate.

## Working-tree hygiene

The fixture generator changed `dataset/documents/phase6-fixtures/manifest.json` only as a test-generation side effect in this Windows workspace. That tracked file was restored to the baseline version after tests. Build outputs (`dist`, `.next`, `node_modules`) are ignored and are not part of the migration diff.

At Phase 2 exit, the only intended tracked additions are the HELIOS v2 migration documentation files.

## Phase 2 exit check against all prior context

### Persistent context

- Locked doctor-avatar patient UI changed: NO.
- Doctor-dashboard runtime/source changed: NO.
- Hindi/Hinglish target weakened: NO.
- Diagnosis/prescription authority added: NO.
- PostgreSQL schema/data changed: NO.
- Legacy capability deleted: NO.
- Figma touched: NO.

### Phase 1 audit invariants

- Actual Next.js/Express/Prisma/PostgreSQL architecture remains the migration baseline: PASS.
- Existing specialization routing is treated as an asset to migrate/evolve rather than a greenfield feature: PASS.
- Express/Prisma remain required while the unchanged doctor dashboard still depends on them: PASS.
- High-confidence repository cleanup candidates remain only classified; none were removed: PASS.

Phase 3 can now define the target contracts and coexistence architecture against a passing v1 source baseline.
