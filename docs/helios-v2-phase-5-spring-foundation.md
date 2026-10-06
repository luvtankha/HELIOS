# HELIOS v2 Phase 5 — Spring Boot patient foundation

Status: **MODEL-INDEPENDENT FOUNDATION IMPLEMENTED**.

Phase 4's real-model GPU gate remains open, but the Spring application foundation does not depend on a selected speech model. Building it in parallel does not weaken the Phase 4 acceptance rule and does not switch patient traffic away from v1.

## Implemented

New isolated module: `backend-java/`.

- Java source/target: 21.
- Spring Boot: 4.1.1.
- Maven Wrapper checked into the module; no global Maven installation required.
- WebFlux, Security, Validation, Actuator, Spring Data JPA, PostgreSQL driver and Flyway dependencies installed.
- PostgreSQL is still the intended system of record.
- Hibernate DDL mode is `validate`; it is not allowed to create/update the shared schema.
- Flyway execution is disabled by default until the explicit Prisma -> Flyway handoff from Phase 3 is verified.
- `/api/v2/meta` is the first public v2 endpoint and exposes the locked `hi-Hinglish` conversation policy and clinician authority marker.
- All other endpoints are authenticated by default; health/meta are the only current public paths.
- Package boundaries exist for patient, consent, visit, intake, voice, routing, documents, queue and audit.
- No doctor-dashboard package or route was added to the Java application.

## Important version correction

Spring Initializr metadata identifies the current stable line as 4.1.1, while its generated parent value included a `.RELEASE` suffix that Maven Central does not use for this artifact. The POM was corrected to `4.1.1`, which resolves successfully from Maven Central.

## Validation

`backend-java\\mvnw.cmd test` compiles the module with `--release 21` and passes the current unit test suite on the available JDK 27 runtime.

The local machine does not currently provide PostgreSQL, Docker or `psql`, so database-connected application startup is not claimed as passed. That remains a Phase 6 integration requirement; no database credentials were fabricated and no shared schema was modified.

## Phase 5 context re-check

- Phase 1 actual repository architecture still respected: YES.
- Phase 2 v1 baseline replaced/deleted: NO.
- Phase 3 `/api/v2` coexistence boundary followed: YES.
- Phase 4 Human-1 accepted without measurements: NO.
- Locked doctor-avatar patient UI changed: NO.
- Doctor-dashboard source changed: NO.
- Hindi/Hinglish policy preserved: YES.
- AI given clinical/routing authority: NO.
- PostgreSQL replaced or destructively migrated: NO.
- Legacy Express/Prisma/Whisper/browser-TTS deleted: NO.
- Figma touched: NO.

The next safe implementation work is the additive JPA/Flyway handoff preparation and patient-session persistence contract, with database-connected verification blocked until an isolated PostgreSQL environment is available.
