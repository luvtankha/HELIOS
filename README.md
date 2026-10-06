# HELIOS

**Healthcare Enabled Language & Intelligent Observation System**

HELIOS is a hackathon project for conversational patient intake and doctor handoff. A patient describes symptoms in Hindi or Hinglish; HELIOS responds in Hindi, collects relevant details, selects a starting specialization, and presents the saved intake in an authenticated doctor dashboard.

The active patient experience uses **Gemini Live native audio**. It sends microphone audio to the model and plays the model's returned audio; it does not chain a separate speech-to-text service, text chatbot and text-to-speech service.

## How it works

1. The patient opens `/patient`, gives consent and enables the microphone.
2. Gemini Live understands Hindi/Hinglish and speaks Hindi. Hindi captions accompany the conversation.
3. The model submits structured facts through a `record_turn` function call. Stored clinical values use English or Roman Hinglish and preserve uncertainty and negation.
4. The Java backend validates the facts and chooses the next question according to missing details, contradictions and symptom-related rules.
5. When intake completes, routing rules choose a specialization and attempt to assign an available matching doctor. If none is available, the intake remains saved awaiting clinic assignment.
6. The doctor signs in, reviews the intake and evidence-linked brief, and can verify, correct, reject or mark facts uncertain.

The consultation screen has a separate hospital background and **five individually interactive SVG characters**. Speaking and listening events animate their body parts; a handoff moves the selected character forward and the previous character back. Tapping or focusing a character shows its AI-guide label without changing clinical routing. Reduced-motion preferences are supported. These characters represent interface guides, not a video call with real doctors.

## Architecture and stack

| Component       | Technology                                                            | Local port                   | Responsibility                                              |
| --------------- | --------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------- |
| Web application | Next.js 15, React 19, TypeScript, Tailwind CSS 3                      | `3000`                       | Patient conversation and doctor workspace                   |
| Doctor API      | Node.js, Express 5, TypeScript, Prisma 6                              | `5000`                       | Doctor authentication, assigned records, briefs and review  |
| Patient API     | Java 21, Spring Boot 4.1.1, JPA, Flyway                               | `8080`                       | Consent, sessions, validated intake, follow-ups and routing |
| Voice gateway   | Python 3.12, FastAPI, Uvicorn, Google Gen AI SDK                      | `9090`                       | Native audio transport and structured model callbacks       |
| Database        | PostgreSQL                                                            | `55435` in the local profile | Shared application persistence                              |
| Voice model     | Gemini Live                                                           | External service             | Hindi/Hinglish understanding and Hindi audio responses      |
| Tests           | Vitest, Testing Library, Playwright, axe, Java tests, Python unittest | —                            | Component, service, browser and accessibility checks        |

The browser obtains consent/session credentials from Java and connects to the Python gateway for audio. Python forwards extracted facts to Java. Java owns the intake policy and saves the accepted data in PostgreSQL; Express reads the shared records for the doctor dashboard. The model supplies language understanding, while backend rules control accepted facts and workflow transitions.

Flyway owns the current v2 schema migrations. Prisma supplies the doctor API's database client. Its older migration history is retained for legacy workflows and isolated tests; do not apply both histories indiscriminately to one database.

## Repository structure

```text
apps/
  web/                 Next.js patient and doctor interfaces
  api/                 Express doctor API, Prisma schema and API tests
backend-java/          Spring Boot patient API, migrations and Java tests
voice-service/         Python native audio gateway, adapters and tests
packages/shared/       Shared TypeScript contracts and validation
contracts/             API and event contracts
dataset/               Synthetic data, routing data and evaluation fixtures
scripts/               Local startup, provisioning, health and test tools
tests/                 Browser and integration test suites
ops/                   Operational configuration
compose.v2.yml         Multi-service container configuration
.env.v2.example        Current native voice configuration template
pnpm-workspace.yaml    JavaScript workspace configuration
```

Local credentials, dependencies, build outputs and `.local/` runtime data are excluded from Git. `.local/postgres` contains the dedicated local database; removing it removes those local records.

## Run locally on Windows

Use PowerShell from the repository root. Install these prerequisites:

- Node.js 22 or newer compatible with **pnpm 11.19.0**, the version pinned in `package.json`.
- Java 21 or a compatible newer JDK. The Maven wrapper is included.
- `uv` and **Python 3.12**; the Python project requires `>=3.12,<3.13`.
- PostgreSQL binaries. The container configuration uses PostgreSQL 16; the local Windows helper also supports installed newer versions.
- A Gemini API key with access to the configured native audio model, internet access and a microphone-enabled browser.

The Windows helpers look under standard `Program Files` Java/PostgreSQL directories. Set `JAVA_HOME` or `HELIOS_POSTGRES_BIN` if your installations are elsewhere.

### Configure

For a fresh checkout:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.v2.example .env }
```

Edit the private `.env`, replace every `REQUIRED_...` placeholder and set `GEMINI_API_KEY`. Use separate random secrets, keep PostgreSQL credentials consistent, and URL-encode special characters in connection-string credentials. Keep API keys server-side; never use a `NEXT_PUBLIC_` variable for a secret.

| Setting                                             | Purpose                                                              |
| --------------------------------------------------- | -------------------------------------------------------------------- |
| `HELIOS_LOCAL_DATABASE=true`                        | Enables the dedicated project-local PostgreSQL helper                |
| `DATABASE_URL`                                      | Local profile requires `127.0.0.1:55435/helios`                      |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Database/container settings                                          |
| `GEMINI_API_KEY`                                    | Private server-side Gemini credential                                |
| `HELIOS_VOICE_PROVIDER=gemini-live`                 | Selects the active native audio adapter                              |
| `HELIOS_GEMINI_LIVE_MODEL`                          | Model identifier; the template currently specifies `gemini-3.8-live` |
| `SESSION_TOKEN_SECRET`                              | Session/proof signing secret                                         |
| `HELIOS_VOICE_RUNTIME_SECRET`                       | Voice ticket authentication secret                                   |
| `HELIOS_VOICE_CONTROL_SECRET`                       | Separate internal callback/control secret                            |
| `DOCTOR_DEMO_ACCESS_CODE`                           | Private credential used by local doctor provisioning                 |
| `NEXT_PUBLIC_API_URL`                               | Browser-facing doctor API address                                    |
| `NEXT_PUBLIC_PATIENT_API_V2_URL`                    | Browser-facing patient API address                                   |
| `NEXT_PUBLIC_VOICE_RUNTIME_URL`                     | Browser-facing voice gateway address                                 |
| `HELIOS_PATIENT_API_URL`, `HELIOS_VOICE_PUBLIC_URI` | Gateway callback and browser connection addresses                    |
| `HELIOS_ALLOWED_ORIGINS`                            | Allowed web origins                                                  |
| `HELIOS_FLYWAY_ENABLED=true`                        | Enables the current Java migrations                                  |

The example keeps demo mode disabled. Confirm the configured model's availability and your account's quota before presenting. Billing status is controlled in the provider account and cannot be inferred from the key; unlimited free operation is not guaranteed.

### Development

```powershell
pnpm install
pnpm db:generate
pnpm dev
```

`pnpm dev` starts the local database when enabled, synchronizes Python dependencies, builds shared contracts and launches all four application services. Java applies Flyway migrations during startup.

After Java finishes starting, open a second terminal and run:

```powershell
pnpm local:doctor
```

This provisions the local username **`helios-local`**, using `DOCTOR_DEMO_ACCESS_CODE` as its private password/access code. It creates an Internal Medicine doctor, not a complete specialty roster. Run it again after changing the code. This helper accepts only the dedicated local database profile.

- Patient: [http://localhost:3000/patient](http://localhost:3000/patient)
- Doctor: [http://localhost:3000/doctor/login](http://localhost:3000/doctor/login)

### Built application

Stop the development service group before switching to the built application:

```powershell
pnpm build
Push-Location backend-java
.\mvnw.cmd clean package
Pop-Location
pnpm start
```

`pnpm start` runs the built Next.js application, compiled Express API, packaged Java JAR and Python gateway. The commands above use the default localhost addresses. If changing browser-facing URLs, provide the `NEXT_PUBLIC_*` values to the build environment and rebuild; these values are embedded in the frontend. When setting `NODE_ENV=production` externally, provide server configuration through the process environment because the startup wrapper skips automatic `.env` loading in that mode.

Press **Ctrl+C** to stop the service group. Stop the dedicated database separately with `pnpm local:db:stop`. Restart with `pnpm dev` or `pnpm start`, as appropriate.

## Checks

With the services running, `pnpm presentation:check` checks the web application and these endpoints:

- Doctor API: `/health` on port `5000`
- Patient API: `/actuator/health` on port `8080`
- Voice gateway: `/healthz` on port `9090`

Service health alone does not prove an actual model conversation succeeds. Run checks appropriate to your changes:

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:db
pnpm exec playwright install chromium
pnpm test:live-ui
```

`test:db` uses an isolated regression schema on the configured local database. Browser tests include simulated audio transport for deterministic UI checks; they are not all actual-provider conversations.

```powershell
# Java service tests
Push-Location backend-java
.\mvnw.cmd test
Pop-Location

# Python gateway tests
uv sync --project voice-service --no-install-project
$env:PYTHONPATH = 'voice-service/src'
uv run --project voice-service --no-sync python -m unittest discover -s voice-service/tests

# Actual provider checks; require running services and consume Gemini quota
pnpm voice:smoke
pnpm voice:roundtrip
node --env-file=.env scripts/check-live-handoff.mjs
```

The roundtrip uses synthetic Hindi audio and creates synthetic patient/visit records. These commands describe available verification; this README does not claim that every check passed on every environment or revision.

## Troubleshooting and limits

- **No microphone/audio:** allow microphone access, check the device and volume, and use the retry control. Access from another device requires reachable service URLs, an allowed origin and HTTPS/WSS; that device's `localhost` does not refer to your development PC.
- **Voice unavailable:** check Java/Python health, key/model access, network and provider quota. A configured key alone does not establish provider availability.
- **Doctor login fails:** wait for migrations, run `pnpm local:doctor`, and use the current private access code.
- **Intake has no assigned specialist:** configure an active doctor accepting that specialization; the default local account covers Internal Medicine only.
- **Database/Java startup fails:** check binaries, `JAVA_HOME`, `HELIOS_POSTGRES_BIN`, the connection settings and startup errors. Do not start duplicate services on occupied ports.

HELIOS is an engineering prototype for intake and referral support, not a clinically validated diagnosis or treatment system. Extraction and routing can be wrong; a clinician must review the result. Accent, noise, emergency handling, concurrent users and deployment behavior need evaluation beyond automated tests. Native voice requires the external Gemini service; the experimental local Human-1 adapter is not the default offline replacement.

Audio is sent to Gemini. The normal gateway flow does not persist patient microphone audio, but structured facts are saved. Real patient deployment requires appropriate consent, data governance, access controls and operational review. Existing document, timeline, verification and AYUSH modules extend the doctor workspace; they do not imply a complete hospital EHR integration.

Gemini provides the underlying native audio model. HELIOS implements the conversation workflow, validation, routing, persistence and user interfaces. Third-party dependencies retain their own licenses; this repository currently provides no root license grant.
