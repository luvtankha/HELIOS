# HELIOS

**Healthcare Enabled Language & Intelligent Observation System**

### Native Hindi voice intake, structured clinical context, and doctor handoff

HELIOS is a hackathon prototype that helps patients describe their symptoms through a natural Hindi conversation, understands Hindi/Hinglish input, and prepares structured information for a doctor. It asks relevant follow-up questions, recommends a starting specialization, and makes the collected information available in an authenticated doctor workspace.

The current patient flow uses **Gemini Live native audio**: microphone audio goes to the model and model audio returns to the patient. Structured function calls capture facts alongside the conversation. There is no separate speech-to-text → text-generation → text-to-speech pipeline in this active flow.

**Status:** the local native-audio-to-doctor workflow has been exercised with synthetic Hindi audio. This is an engineering prototype for pre-consultation intake and referral support; clinical diagnosis and treatment remain with a clinician.

**Documentation baseline: 5 October 2026.** This README describes the current v2 patient flow. The [final engineering review](docs/final-engineering-review-2026-10-05.md) is the authoritative record of the latest executed checks, acceptance status and remaining limitations. Older phase/SIH documents describe earlier snapshots.

## Contents

- [Problem and intended value](#problem-and-intended-value)
- [Patient and doctor experience](#patient-and-doctor-experience)
- [Implemented scope](#implemented-scope)
- [Architecture and technology](#architecture-and-technology)
- [Conversation, logging, and routing](#conversation-logging-and-routing)
- [Repository structure](#repository-structure)
- [Local setup](#local-setup)
- [Configuration](#configuration)
- [Testing and health](#testing-and-health)
- [Hackathon demonstration](#hackathon-demonstration)
- [Efficiency and scaling](#efficiency-and-scaling)
- [Privacy and access controls](#privacy-and-access-controls)
- [Troubleshooting](#troubleshooting)
- [Limitations and next steps](#limitations-and-next-steps)
- [Documentation and ownership](#documentation-and-ownership)

## Problem and intended value

A patient's first description of a health concern can be incomplete, difficult to type, or spread across several answers. A clinician must establish what happened, when it began, how severe it is, and what else accompanies it. Language and unfamiliar medical terminology can make that exchange harder.

HELIOS explores whether conversational intake can prepare this context before the consultation. The intended benefits are easier symptom reporting, fewer repeated intake questions, clearer documentation, and a more informed first referral. These are product hypotheses: the project has not measured consultation time saved, referral accuracy in a clinical population, or patient outcomes.

The initial audience is Hindi/Hinglish-speaking patients and clinicians reviewing their intake. A possible deployment setting is a supervised clinic reception or waiting area with a microphone-enabled device and reliable internet.

## Patient and doctor experience

### Patient journey

1. Open `/patient`, which leads into the live consultation experience.
2. Review the Hindi consent prompt and allow microphone access.
3. Describe the main concern naturally in Hindi or Hinglish.
4. HELIOS speaks Hindi, acknowledges the answer, and asks the next server-approved question.
5. Missing identity information and relevant symptom details are captured without deliberately restarting the complaint.
6. Once required intake is sufficiently covered, the backend selects a specialization and attempts to assign an available matching clinician.
7. The patient hears and sees completion, including whether the information was handed off or awaits clinic assignment.
8. After completion, choose **नई बातचीत शुरू करें** to begin another consultation with a fresh session and consent.

The interface shows five illustrated clinicians, an active central clinician, a speech bubble with Hindi captions, a listening state, and an avatar handoff. These are interface states, not a live video call or five independent medical agents.

The hospital is a separate vector background. Each of the five clinicians is an independent interactive SVG character with movable head, eyes, mouth and arms. Live speaking/listening events control the poses; clinical handoff moves the selected guide forward while the previous guide steps back. Tapping or focusing a character reveals its guide details without changing clinical routing. Reduced-motion preferences disable animation. See [the scene implementation](docs/reference-ui-artwork.md).

### Doctor journey

1. Sign in at `/doctor/login`.
2. Open an assigned patient from the workspace/queue.
3. Review live facts, knowledge states, confidence labels, evidence turn identifiers, and the specialization recommendation.
4. Read the clinical brief generated from stored facts and other available records.
5. In **Verification**, filter **Live intake**, open the evidence, and verify, correct, reject or mark a fact uncertain. Corrections preserve an explicit knowledge state and record the doctor's action.
6. Refresh the workspace to see the review status and updated brief, then make the clinical decision independently.

The current local account is `helios-local`. Its access code is stored privately in `.env` under `DOCTOR_DEMO_ACCESS_CODE`; the database stores a salted password hash. Despite that variable's historical name, this account works with demo mode disabled.

## Implemented scope

| Capability         | Current behavior                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Native voice       | Gemini Live receives/produces audio; Python bridges browser and provider                                            |
| Language           | Hindi speech/captions; Hindi/Hinglish understanding; English/Roman Hinglish clinical values                         |
| Sessions           | Consent, patient session proofs, signed voice tickets, authenticated runtime callbacks                              |
| Follow-ups         | Deterministic priorities for conflicts, selected symptom-specific safety questions, core fields, and context        |
| Intake             | Identity and clinical candidates validated and persisted with patient-reported provenance                           |
| Routing            | Versioned heuristic mappings, emergency rules, generalist fallback, and rationale                                   |
| Assignment         | Matches active clinicians accepting the specialty and considers active workload                                     |
| Doctor view        | Assigned records, live facts, routing, and an evidence-linked clinical brief                                        |
| Fact review        | Native facts enter the verification queue; authorized doctors can verify, correct, reject or mark them uncertain    |
| Recovery           | Bounded reconnects, fresh tickets, persisted context, microphone retry, completion recovery and fresh consultations |
| Supporting modules | Existing documents, timeline, comparison, verification, AYUSH records, and queue modules                            |

Supporting modules extend beyond the live demonstration. Their presence does not mean the native flow automatically populates every historical record type or that all older demo flows use the same runtime.

## Architecture and technology

### Data flow

```text
PATIENT BROWSER — Next.js / React
  |
  +-- consent, proof, voice ticket --> JAVA PATIENT API /api/v2
  |                                         |
  |                                         +--> PostgreSQL
  |
  +== microphone / generated audio ==> PYTHON VOICE GATEWAY
                                           |
                                           +== native audio ==> Gemini Live
                                           |
                                           +-- record_turn --> JAVA PATIENT API
                                                                 |
                                                                 +-- validate facts
                                                                 +-- next question
                                                                 +-- route/assign
                                                                 +-- save intake

DOCTOR BROWSER — Next.js / React
  |
  +-- authenticated request --> EXPRESS DOCTOR API /api/v1 --> PostgreSQL
                                  |
                                  +-- workspace and clinical brief
```

Audio and application data have different paths. Gemini handles native speech understanding/generation; Java controls accepted facts, workflow and routing. Express serves the existing doctor workspace. PostgreSQL connects persisted intake to the doctor view.

### Stack

| Layer           | Technology                                                            | Purpose                                                      |
| --------------- | --------------------------------------------------------------------- | ------------------------------------------------------------ |
| Web             | Next.js 15, React 19, TypeScript, Tailwind CSS 3                      | Patient/doctor routes, responsive UI, audio capture/playback |
| Patient backend | Java 21 target, Spring Boot 4.1.1, JPA, Flyway                        | Sessions, consent, identity, intake policy, routing, handoff |
| Doctor backend  | Node.js, Express 5, TypeScript, Prisma 6                              | Login, assigned records, briefs, documents, review           |
| Voice gateway   | Python 3.12, FastAPI, Uvicorn, Google Gen AI SDK                      | Audio transport and model tool-call integration              |
| Model           | Gemini Live, configured through `HELIOS_GEMINI_LIVE_MODEL`            | Hindi/Hinglish audio understanding and Hindi speech          |
| Database        | PostgreSQL                                                            | Shared relational persistence                                |
| JS workspace    | pnpm workspaces                                                       | Shared contracts and coordinated commands                    |
| Tests           | Vitest, Testing Library, Playwright, axe, Java tests, Python unittest | Unit, integration, browser and accessibility checks          |
| Operations      | Spring Actuator; Compose/Prometheus configuration                     | Health endpoints and deployment/monitoring scaffolding       |

Exact JavaScript/Python resolutions are in `pnpm-lock.yaml` and `voice-service/uv.lock`. The environment template currently uses `gemini-3.8-live`; model access must be verified in the target environment.

### Why multiple backends?

HELIOS evolved from an Express doctor/document prototype into a native-voice patient flow with Java domain policies. Python handles the provider/audio integration. Retaining working doctor modules avoided a complete rewrite during the hackathon.

The tradeoff is additional services, integration boundaries and operational complexity. Three backend languages are not a requirement for every intake product. Future consolidation should follow maintainability needs and measured workloads.

### Database ownership

Flyway owns current v2 schema setup. Prisma is the doctor API's database client; its historical migrations are also used in isolated legacy integration tests. Do not blindly apply both migration histories to the same live schema. Existing databases need a reviewed baseline/migration handoff.

Important records include patient sessions, consent, identity, voice sessions/events, `HeliosIntakeFact`, profiles, visits, routing decisions, doctor-patient assignments and clinical briefs. Facts carry field/value, knowledge state, confidence, source, evidence turn identifiers, model/policy metadata, and timestamps.

## Conversation, logging, and routing

### Native audio and structured logging

The browser sends 24 kHz mono PCM16 microphone audio through a signed WebSocket connection to the gateway. Gemini returns native audio. Output transcription supplies Hindi captions; captions do not turn the architecture into a separate text-to-speech pipeline.

The model calls `record_turn` with facts from the patient's answer. Python attaches provenance and submits the turn to Java. Java validates allowed fields/values, saves accepted data, and returns the next question intent or completion. The model phrases that instruction naturally in Hindi.

Clinical values use English or Roman Hinglish. The gateway does not persist ordinary patient microphone audio. Synthetic audio from the test harness is stored separately under ignored `.local` paths. Audio still travels to the external Gemini service; processing is not entirely on-device.

### Follow-up policy

Core fields are main concern, onset, severity, pattern and associated symptoms. Additional questions depend on recognized complaint patterns. Chest concerns trigger questions about breathing, fainting/sweating and radiating discomfort; abdominal concerns include location and gastrointestinal symptoms. These describe implemented rules, not a validated diagnostic protocol.

Conflicts receive clarification priority. Explicit `UNKNOWN` differs from `KNOWN` with a negative answer. Silence is not converted into “no.” Answered fields, including explicit uncertainty where allowed, are not repeatedly requested. The policy covers a bounded set of symptom patterns rather than unrestricted clinical reasoning.

### Specialization and assignment

The Java router uses a versioned dataset and deterministic matching/scoring. It considers reported context and supported negation, historical-context, age and emergency rules. Broad or ambiguous cases fall back to a generalist starting point. Heuristic match confidence is not a disease probability or proof of correct referral.

The handoff service finds an active clinician accepting the specialty and considers workload. If none is available, the record awaits clinic assignment. The seeded local doctor accepts **Internal Medicine**; other specialists require a configured roster.

### Clinical brief

The doctor API combines live facts with available structured records. Claims retain evidence references and review status. Source revision and generator version support caching/freshness checks. Patient reports are not automatically upgraded to doctor-verified truth. Native facts participate in the doctor verification workflow; corrected values and review status feed the refreshed brief, and rejected or superseded facts are excluded from active brief claims while their review history remains available.

## Repository structure

```text
HELIOS/
├── README.md                         Current project guide
├── HELIOS_JUDGES_QA.txt               Beginner-friendly presentation preparation
├── apps/
│   ├── web/                          Next.js patient and doctor UI
│   └── api/                          Express API, Prisma, supporting modules
├── backend-java/                     Spring Boot patient/voice domain backend
├── voice-service/                    Python gateway, adapters, native tests
├── packages/shared/                  Shared TypeScript contracts
├── contracts/                        Cross-service contract artifacts
├── dataset/                          Routing/reference data and synthetic fixtures
├── scripts/                          Startup, database, provisioning, checks
├── tests/                            Browser/end-to-end tests
├── docs/                             Architecture, operation, health, history
├── ops/                              Monitoring configuration
├── outputs/                          Earlier project reports
├── compose.v2.yml                    Multi-service container configuration
├── .env.v2.example                   Non-secret configuration template
├── .env                              Private local settings; Git-ignored
└── .local/                           Ignored database and test artifacts
```

The sibling `../items to be deleted` is a manual-cleanup location, not a dependency. Retain `.local/postgres` when retaining the project's local records.

## Local setup

### Prerequisites

- Node.js 22+ compatible with the pinned pnpm release.
- pnpm matching root `packageManager` (currently 11.19.0).
- Java 21 or a newer compatible JDK; Maven wrapper is included.
- `uv` and Python 3.12.
- PostgreSQL 16+; the validated Windows environment used PostgreSQL 18.
- Gemini credentials with access to the configured native audio model.
- A microphone-enabled browser and internet connectivity.

Windows scripts detect Java/PostgreSQL under standard `Program Files` paths. Set `JAVA_HOME` and `HELIOS_POSTGRES_BIN` for other installations. Commands below are PowerShell commands from the repository root unless noted.

### 1. Configure the private environment

For a fresh checkout only:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.v2.example .env }
```

Edit `.env` locally. Replace all `REQUIRED_...` placeholders with strong, separate values and set `GEMINI_API_KEY`. Match PostgreSQL credentials in `DATABASE_URL` and database settings; URL-encode special characters in connection-string credentials.

**This existing workspace is already configured.** Do not overwrite `.env`, put API keys in frontend variables, or include secrets in presentation materials.

### 2. Install and start

```powershell
pnpm install
pnpm db:generate
pnpm dev
```

`pnpm dev` delegates to `pnpm dev:v2`. It starts the dedicated database when enabled, synchronizes Python dependencies, builds shared contracts, then runs Next.js, Express, Java and Python.

The local database helper requires `127.0.0.1:55435/helios` and stores data in `.local/postgres`. Java applies Flyway migrations at startup. This is separate from any existing PostgreSQL service on port 5432.

### 3. Provision the local doctor

After Java startup/migrations complete, run in another terminal:

```powershell
pnpm local:doctor
```

This local-only command creates/updates `helios-local` and its password hash from the private access code. Re-run after changing that code. It does not provision a full specialty roster.

### 4. Open the application

| Service              | Address                               |
| -------------------- | ------------------------------------- |
| Patient entry        | http://localhost:3000/patient         |
| Doctor login         | http://localhost:3000/doctor/login    |
| Doctor API health    | http://localhost:5000/health          |
| Patient API health   | http://localhost:8080/actuator/health |
| Voice gateway health | http://localhost:9090/healthz         |

Use the configured localhost origin consistently. Remote devices need reachable URLs, an allowed origin and HTTPS/WSS for normal microphone operation; another device's localhost refers to that device.

### Stop and restart

Ctrl+C stops the development service group. Stop the dedicated database separately:

```powershell
pnpm local:db:stop
```

Run `pnpm dev` to restart. Avoid duplicate instances on occupied ports.

`pnpm dev` starts all four services for development. For the presentation, build both application stacks, then start all four services from one terminal:

```powershell
pnpm build
cd backend-java
.\mvnw.cmd clean package
cd ..
pnpm start
```

`pnpm start` uses the optimized Next.js build, compiled Express server, packaged Java JAR and Python voice gateway. It also prepares the configured local database and Python environment. Use a second terminal for `pnpm presentation:check`; all four endpoints should pass. A missing Java JAR produces a build-first message. Stop the existing service group before switching between development and production commands.

## Configuration

| Variable                                            | Responsibility                                            |
| --------------------------------------------------- | --------------------------------------------------------- |
| `DATABASE_URL`                                      | PostgreSQL connection for Node/local startup              |
| `HELIOS_LOCAL_DATABASE`                             | Enables the project-local database helper                 |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Database/Compose settings                                 |
| `SESSION_TOKEN_SECRET`                              | Signed session/proof configuration                        |
| `HELIOS_VOICE_RUNTIME_SECRET`                       | Voice ticket authentication                               |
| `HELIOS_VOICE_CONTROL_SECRET`                       | Internal voice control/callback authentication            |
| `GEMINI_API_KEY`                                    | Server-side Gemini credential                             |
| `HELIOS_VOICE_PROVIDER`                             | `gemini-live` for the active implementation               |
| `HELIOS_GEMINI_LIVE_MODEL`                          | Native audio model identifier                             |
| `HELIOS_PATIENT_API_URL`                            | Patient API address used by Python                        |
| `HELIOS_VOICE_RUNTIME_URI`                          | Java's internal gateway address, when overriding defaults |
| `HELIOS_VOICE_PUBLIC_URI`                           | Gateway address reachable by the browser                  |
| `NEXT_PUBLIC_API_URL`                               | Browser-facing Express address                            |
| `NEXT_PUBLIC_PATIENT_API_V2_URL`                    | Browser-facing Java address                               |
| `NEXT_PUBLIC_VOICE_RUNTIME_URL`                     | Browser-facing voice address/CSP settings                 |
| `HELIOS_ALLOWED_ORIGINS`                            | Allowed patient/web origins                               |
| `HELIOS_FLYWAY_ENABLED`                             | Enables Java migrations                                   |
| `HELIOS_FLYWAY_BASELINE_ON_MIGRATE`                 | Baseline behavior; fresh local template uses false        |
| `DOCTOR_DEMO_ACCESS_CODE`                           | Local doctor provisioning password source                 |
| `ENABLE_DEMO_MODE`, `DEMO_MODE`                     | Historical demo toggles; false for the current workflow   |
| `HELIOS_VOICE_REQUIRE_BENCHMARK_APPROVAL`           | Experimental adapter gate, not Gemini clinical validation |

Next.js public settings are compiled into browser code and must contain only public addresses/settings. Rebuild after changing deployment URLs.

The chosen setup aims to use a free-tier Gemini project with billing disabled. Quota, model access and billing belong to the provider account and cannot be inferred from an API key. Unlimited free operation and a fixed production cost are not promised.

## Testing and health

### Routine checks

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:db
```

`test:db` uses an isolated regression schema on the configured local database. Do not repoint tests at production data.

Java:

```powershell
cd backend-java
.\mvnw.cmd test package
cd ..
```

Python:

```powershell
cd voice-service
uv sync --no-install-project
$env:PYTHONPATH = 'src'
uv run --no-sync python -m unittest discover -s tests
cd ..
```

### Browser and actual provider checks

With all local services running:

```powershell
pnpm exec playwright install chromium
pnpm test:live-ui
pnpm voice:smoke
pnpm voice:roundtrip
node --env-file=.env scripts/check-live-handoff.mjs
```

The browser suite simulates audio transport for deterministic UI testing. Actual provider checks consume Gemini quota. The roundtrip uses synthetic Hindi audio and creates a synthetic patient/visit; it differs from a human speaking into a physical microphone.

To include authenticated doctor UI validation after a successful roundtrip:

```powershell
$env:HELIOS_LIVE_HANDOFF_UI = 'true'
node --env-file=.env node_modules/@playwright/test/cli.js test --config playwright.live.config.ts --workers=2
Remove-Item Env:HELIOS_LIVE_HANDOFF_UI
```

### Recorded results — audit completed 5 October 2026

| Check                                     | Recorded outcome                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| API regression                            | 327 passed; 13 conditional tests skipped                                                                |
| Web component                             | 92 passed                                                                                               |
| Java                                      | 53 passed                                                                                               |
| Python                                    | 33 passed                                                                                               |
| Database integration                      | 20 passed; 1 optional Java handoff test skipped                                                         |
| Browser, including actual doctor handoff  | 16 passed, including repeated consultations, microphone retry and persisted doctor review               |
| Native audio roundtrip                    | Three separate real-provider sessions passed; each used three synthetic turns and persisted five facts  |
| Doctor handoff                            | Authenticated access, Internal Medicine routing, anonymous access denied                                |
| Accessibility                             | No serious/critical automated violations on the tested patient, login and native-intake workspace views |
| Type checks, lint, builds, service health | Passed in the recorded run                                                                              |

Results are a dated snapshot, not proof that every behavior, device or clinical condition is validated. Skipped checks are explicit; suite counts are not a clinical accuracy metric. Consult the [final engineering review](docs/final-engineering-review-2026-10-05.md) for the latest run, failures, remaining blocks and presentation acceptance. The [earlier health report](docs/health-check-2026-10-04.md) is historical evidence.

## Hackathon demonstration

### Suggested three-minute sequence

| Time      | Show and explain                                                            |
| --------- | --------------------------------------------------------------------------- |
| 0:00–0:25 | Problem: prepare structured context from natural symptom descriptions       |
| 0:25–1:30 | Consent and short Hindi conversation using an explicitly synthetic identity |
| 1:30–2:15 | Doctor login, the same patient's facts, evidence and specialization         |
| 2:15–2:40 | Native audio plus server-controlled questions/routing                       |
| 2:40–3:00 | Validation results, current limits and next pilot milestone                 |

A rehearsable synthetic concern is mild fatigue. Answer the questions actually asked; do not require a fixed transcript. This matches the configured Internal Medicine doctor, avoiding claims that an unconfigured department received a referral.

Before presenting, run `pnpm presentation:check`, check microphone permission, provider quota and doctor login. That command checks the running application; it does not replace an actual-provider conversation. Retain recent synthetic results/screenshots as backup evidence. If the provider/network fails, explicitly label any replay as recorded; never present mocked transport as a live model call. The schedule above is a presentation plan, not measured consultation duration.

The separate [judge preparation text file](HELIOS_JUDGES_QA.txt) starts from zero technical knowledge and includes spoken answers, explanations, challenges and rehearsal guidance.

## Efficiency and scaling

Targeted improvements include fixed-size PCM accumulation, bounded reconnects/question buffers, Set/Map-based matching/grouping, client/audio cleanup, and revision-based brief caching.

For grouping `n` records, Set/Map indexing can provide expected O(n) traversal with O(n) auxiliary storage instead of repeated scans/copies approaching O(n²). This describes particular operations, not the complexity of the entire project. Routing candidate sorting, database queries, networking and model inference have separate costs.

The recorded build gave the live route 8.41 kB of route JavaScript, about 102 kB shared initial JavaScript and 116 kB total first-load JavaScript for that route. No percentage reduction in latency or memory is claimed without comparable before/after measurements.

Scaling requires measured concurrent sessions, provider quota planning, connection-aware gateway deployment, distributed controls where needed, database pooling and load testing. Process-local coordination/rate controls do not imply distributed guarantees.

## Privacy and access controls

- Consent precedes the active voice workflow.
- Session proofs and voice tickets scope access to the intended session.
- Internal callbacks require a control secret; model output cannot grant doctor privileges.
- Doctor access uses hashed credentials and assigned-patient authorization.
- Validation, provenance, review states and audit mechanisms exist in the project.
- Normal native audio is streamed rather than saved by the gateway; structured facts persist.
- The external provider processes audio. Its terms and deployment data governance need review before real patient use.

A turn identifier links a fact to its originating interaction; it is not proof of word-for-word accuracy or a retained recording.

The project does not claim clinical certification, completed legal/privacy compliance assessment, or production-grade multi-tenant isolation. Public deployment also needs HTTPS/WSS, secret management, backups, retention/deletion policy and operational monitoring.

## Troubleshooting

| Symptom                             | Check/action                                                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Page loads but voice unavailable    | Check Java/Python, key/model access and `/healthz`; credential presence alone does not prove provider availability    |
| Microphone does not start           | Allow the microphone in browser settings, then choose **माइक्रोफ़ोन फिर शुरू करें**; check device and localhost/HTTPS |
| No audible response                 | Check volume/device/browser restrictions and gateway errors without exposing secrets                                  |
| Reconnect ends in error             | Address provider/network cause and choose **बातचीत फिर जोड़ें**; saved facts are resumed and retries are bounded      |
| Completed screen remains on refresh | This is intentional session recovery; choose **नई बातचीत शुरू करें** for a fresh patient/consent flow                 |
| Doctor login fails                  | Wait for migrations, run `pnpm local:doctor`, use current private code                                                |
| No specialist receives saved intake | Configure an active doctor accepting that specialty; default is Internal Medicine only                                |
| Port occupied                       | Reuse or stop the existing HELIOS instance                                                                            |
| Database startup fails              | Check PostgreSQL binaries, local URL, credentials and `HELIOS_POSTGRES_BIN`                                           |
| Java startup fails                  | Check compatible `JAVA_HOME` and migration/startup errors                                                             |
| Browser contacts wrong server       | Check/rebuild `NEXT_PUBLIC_*`; distinguish internal and browser addresses                                             |
| Older English/text flow appears     | Use `/patient`; historical v1 routes remain                                                                           |

## Limitations and next steps

### Current limits

- Active live voice needs internet and an accessible Gemini native audio model.
- Hindi/Hinglish has not been comprehensively evaluated across accents, noise, dialects and clinical populations.
- Model extraction can be wrong despite validation; confidence labels are not calibrated medical probabilities.
- Follow-up/routing rules are bounded heuristics. Emergency-related rules do not establish validated triage or guaranteed early detection.
- The local roster covers one starting specialty; deployment requires real clinic configuration.
- Human-1 is experimental and inactive, requiring hardware/benchmark work. An offline native-voice alternative is not available on the tested PC.
- Compose is configured but was not executed on the validated workstation because Docker was unavailable.
- The demo is not a complete hospital EHR integration; supporting historical modules have their own limits.

### Proposed milestones

1. Clinician review of questions, referral rules, negation and escalation behavior.
2. A consented evaluation set covering Hindi/Hinglish accents, noise, uncertainty, contradictions and high-risk presentations.
3. Measure fact precision/recall, omissions, referral appropriateness, completion/abandonment, turn latency and clinician editing time.
4. Expand the doctor roster and operational fallback for unavailable departments/providers.
5. Deployment hardening, concurrent-user tests, data governance and a supervised clinic pilot.
6. Assess more languages, standards-based record exchange and alternative providers after validating the core flow.

These are plans, not completed integrations, published results or partnerships.

## Documentation and ownership

- [Native consultation operation](docs/live-consultation.md)
- [Final engineering review and acceptance](docs/final-engineering-review-2026-10-05.md)
- [Recorded health check](docs/health-check-2026-10-04.md)
- [Beginner-friendly judge Q&A](HELIOS_JUDGES_QA.txt)
- [Python service guide](voice-service/README.md)
- [Contributing guide](CONTRIBUTING.md)

Older reports are retained as history. Use this README and the final engineering review for current claims, particularly where older documents describe separate speech/text adapters or an Express-only backend.

There is currently no root license grant. Confirm team ownership, hackathon rules and third-party dependency/data/asset licenses before publishing. Credit Gemini as the underlying native audio model; HELIOS contributes the workflow, integrations, policies, structured records and doctor-facing experience.
