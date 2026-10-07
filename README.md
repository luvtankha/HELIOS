# HELIOS

**Healthcare Enabled Language & Intelligent Observation System**

HELIOS is a hackathon project for conversational patient intake. A patient describes symptoms in Hindi or Hinglish; HELIOS speaks Hindi, asks relevant follow-up questions, saves structured clinical information and selects a starting specialization. The project contains the patient experience; the doctor dashboard, its login and its review screens have been removed.

The active conversation uses **Gemini Live native audio**. Microphone audio goes to the model and the returned audio plays in the browser. A separate speech-to-text → text chatbot → text-to-speech pipeline is not used for this patient experience.

## Patient experience

1. Open `/patient`, read the consent notice and enable the microphone.
2. Describe the concern in Hindi or Hinglish. HELIOS responds in Hindi and shows Hindi captions.
3. Gemini submits structured facts through the `record_turn` function. Stored clinical values use English or Roman Hinglish, including uncertainty and negation.
4. The Java backend validates submitted facts and selects follow-ups using missing details, contradictions and symptom-related rules.
5. The completed intake and specialization decision are saved in PostgreSQL. The saved record can support a later clinical workflow; this application does not provide a doctor dashboard to receive or review it.

The consultation screen contains a hospital background and **five separate interactive SVG characters**. Speaking and listening events animate their body parts. When the guide changes, the selected character moves forward and the previous character moves back. Clicking or focusing a character shows its AI-guide label. Character interactions do not change clinical routing, and reduced-motion preferences are respected. The characters are interface guides rather than live video participants.

## Architecture and technology

| Component                             | Technology                                                            | Local port                     | Responsibility                                                                          |
| ------------------------------------- | --------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------- |
| Patient web application               | Next.js 15, React 19, TypeScript, Tailwind CSS 3                      | `3000`                         | Consent, native voice conversation, captions and animated scene                         |
| Patient API                           | Java 21, Spring Boot 4.1.1, JPA, Flyway                               | `8080`                         | Sessions, consent, validated intake, follow-ups, persistence and specialization routing |
| Voice gateway                         | Python 3.12, FastAPI, Uvicorn, Google Gen AI SDK                      | `9090`                         | Native audio WebSockets and structured model callbacks                                  |
| Database                              | PostgreSQL                                                            | `55435` in the local profile   | Saved application records                                                               |
| Native voice model                    | Gemini Live                                                           | External service               | Hindi/Hinglish understanding and Hindi audio responses                                  |
| Legacy patient API and database tools | Node.js, Express 5, TypeScript, Prisma 6                              | `5000` when separately started | Retained legacy patient services, Prisma tooling and regression tests                   |
| Tests                                 | Vitest, Testing Library, Playwright, axe, Java tests, Python unittest | —                              | Component, service, browser and accessibility checks                                    |

The active runtime is **web + Java + Python + PostgreSQL**. Express is retained for legacy patient functionality and database tooling; the normal `pnpm dev` and `pnpm start` commands do not launch it.

The browser obtains patient-session credentials from Java, then connects to Python for audio. Python sends extracted facts to Java. Java validates accepted data and owns workflow transitions. PostgreSQL stores the resulting records. Language understanding comes from Gemini; backend rules govern accepted facts, follow-ups and routing.

Flyway owns the current v2 schema migrations. Prisma provides the retained legacy API's database client. Its older migration history is retained for isolated legacy workflows and tests. Use the migration history intended for the selected database profile.

## Repository structure

```text
apps/
  web/                 Next.js patient interface
  api/                 Legacy patient API, Prisma schema and regression tests
backend-java/          Spring Boot patient API, Flyway migrations and Java tests
voice-service/         Python native audio gateway, adapters and tests
packages/shared/       Shared TypeScript contracts and validation
contracts/             API and event contracts
dataset/               Synthetic data, routing data and evaluation fixtures
scripts/               Startup, Codespaces setup, health and test tools
tests/                 Patient browser and connected integration tests
ops/                   Operational configuration
.devcontainer/         GitHub Codespaces development environment
compose.v2.yml         Patient services and database container configuration
.env.v2.example        Current native voice configuration template
pnpm-workspace.yaml    JavaScript workspace configuration
```

Credentials, dependencies, build outputs and `.local/` runtime data are excluded from Git. `.local/postgres` contains the dedicated local database; deleting that directory removes its local records.

## Run locally on Windows

Use PowerShell from the repository root. Prerequisites:

- Node.js 22 or a compatible newer version, and **pnpm 11.19.0**, pinned in `package.json`.
- Java 21 or a compatible newer JDK. The Maven wrapper is included.
- `uv` and **Python 3.12**; the Python project requires `>=3.12,<3.13`.
- PostgreSQL binaries. The container configuration uses PostgreSQL 16; the local Windows helper also supports installed newer versions.
- A Gemini API key with access to the configured native audio model, internet access and a microphone-enabled browser.

The Windows helpers search standard `Program Files` Java/PostgreSQL directories. Set `JAVA_HOME` or `HELIOS_POSTGRES_BIN` when the binaries are installed elsewhere.

### Configuration

For a fresh checkout:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.v2.example .env }
```

Edit the private `.env`, replace every `REQUIRED_...` value and set `GEMINI_API_KEY`. Use separate random secrets, keep database credentials consistent and URL-encode special characters in connection-string credentials. API keys belong in server-side configuration; `NEXT_PUBLIC_` values are visible to browsers.

| Setting                                             | Purpose                                                       |
| --------------------------------------------------- | ------------------------------------------------------------- |
| `HELIOS_LOCAL_DATABASE=true`                        | Enables the project-local PostgreSQL helper                   |
| `DATABASE_URL`                                      | Dedicated local profile: `127.0.0.1:55435/helios`             |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Database/container settings                                   |
| `GEMINI_API_KEY`                                    | Private Gemini credential                                     |
| `HELIOS_VOICE_PROVIDER=gemini-live`                 | Selects the active native audio adapter                       |
| `HELIOS_GEMINI_LIVE_MODEL`                          | Native audio model identifier from the configuration template |
| `SESSION_TOKEN_SECRET`                              | Patient-session proof signing secret                          |
| `HELIOS_VOICE_RUNTIME_SECRET`                       | Voice-ticket authentication secret                            |
| `HELIOS_VOICE_CONTROL_SECRET`                       | Separate internal callback/control secret                     |
| `NEXT_PUBLIC_PATIENT_API_V2_URL`                    | Browser-facing patient API address                            |
| `NEXT_PUBLIC_VOICE_RUNTIME_URL`                     | Browser-facing voice gateway address                          |
| `HELIOS_PATIENT_API_URL`                            | Python gateway's Java callback address                        |
| `HELIOS_VOICE_PUBLIC_URI`                           | Browser-reachable voice connection address                    |
| `HELIOS_ALLOWED_ORIGINS`                            | Allowed patient web origins                                   |
| `HELIOS_FLYWAY_ENABLED=true`                        | Enables current Java migrations                               |
| `NEXT_PUBLIC_API_URL`                               | Address for retained legacy patient API features, when used   |

Demo mode is disabled in the current template. Confirm model access and remaining provider quota before a presentation. Billing configuration is controlled by the provider account; an API key does not prove billing is disabled or guarantee unlimited free use.

### Development

```powershell
pnpm install
pnpm db:generate
pnpm dev
```

`pnpm dev` starts the dedicated local database when enabled, synchronizes Python dependencies, builds shared contracts and launches the patient web application, Java API and Python voice gateway. Java applies Flyway migrations during startup.

Open [http://localhost:3000/patient](http://localhost:3000/patient). The legacy Express service is optional and can be launched separately through `pnpm dev:services`, with the required environment variables provided to that process. This legacy command also starts the web application, so stop the other service group first to avoid a port conflict.

### Built application

Stop the development service group, then run:

```powershell
pnpm build
Push-Location backend-java
.\mvnw.cmd clean package
Pop-Location
pnpm start
```

The build command compiles shared contracts, the retained legacy API and the web application. Java packaging is a separate step. `pnpm start` launches the built patient web application, the packaged Java JAR and Python gateway.

Browser-facing `NEXT_PUBLIC_*` URLs are embedded at build time. Rebuild after changing them. If `NODE_ENV=production` is set externally, supply server configuration through the process environment: the startup wrapper skips automatic `.env` loading in that mode.

Press **Ctrl+C** to stop the service group. Stop the dedicated database separately with `pnpm local:db:stop`.

## Run from GitHub with Codespaces

The repository includes a Codespaces environment for running the full patient application directly from a GitHub checkout. It runs Java, Python and PostgreSQL alongside Next.js. It is a development/demo host that must stay running for the application to remain available.

The hosted demo is [HELIOS patient intake](https://humble-space-giggle-x5w6q4v75wvxcv74p-3000.app.github.dev/patient). Resume its existing codespace, **humble space giggle**, from [GitHub Codespaces](https://github.com/codespaces) when it has stopped. The current codespace uses a 30-minute idle timeout; opening the patient link does not start a stopped codespace.

1. Open the [HELIOS repository](https://github.com/luvtankha/HELIOS), choose **Code → Codespaces** and create a codespace on `main`.
2. Provide `GEMINI_API_KEY` as a GitHub Codespaces secret available to this repository, or place it in the codespace's private `.env`. Do not commit the key.
3. In the codespace terminal, run:

```sh
pnpm codespace:setup
pnpm codespace:start
```

The setup/start scripts configure the current codespace's browser-facing URLs rather than using the visitor's `localhost`. They use the codespace name to produce the forwarded web, patient API and voice addresses, and configure the permitted web origin. The browser uses HTTPS and secure WebSockets through GitHub's forwarding layer while services communicate internally.

Forward application ports **3000, 8080 and 9090**. For a public demonstration, these three forwarded ports must be accessible to the browser using the published web URL; set their visibility to **Public** in the Codespaces Ports panel when sharing without GitHub authentication. Keep the database port private and unforwarded. GitHub documents port visibility and the forwarded URL format in [Forwarding ports in your codespace](https://docs.github.com/en/codespaces/developing-in-a-codespace/forwarding-ports-in-your-codespace).

If a public port returns a gateway error even though its local health check passes, stop forwarding that port and add **`0.0.0.0:3000`**, **`0.0.0.0:8080`** or **`0.0.0.0:9090`** in the Ports panel, then set the replacement to Public. This fixed forwarding in the hosted demo. Keep the numeric `forwardPorts` entries in `.devcontainer/devcontainer.json`; Codespaces does not support the `host:port` variation in that configuration.

The patient URL has this form:

```text
https://<codespace-name>-3000.app.github.dev/patient
```

The two backend URLs use the same name with ports `8080` and `9090`. Use the actual address printed by the scripts or shown in the Ports panel.

Codespaces can stop after inactivity, and personal accounts have bounded included compute/storage usage. Check remaining usage and account spending settings before keeping it running. It is not guaranteed free, permanent production hosting. See [GitHub Codespaces billing](https://docs.github.com/en/billing/concepts/product-billing/github-codespaces).

## Health and verification

With the active services running, `pnpm presentation:check` checks the patient web application and the backend endpoints:

- Java API: `/actuator/health` on port `8080`.
- Python gateway: `/healthz` on port `9090`.

Service health does not by itself verify a successful model conversation. Run the checks relevant to the change:

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:db
pnpm exec playwright install chromium
pnpm test:live-ui
```

`test:db` uses an isolated regression schema on the configured local database. Patient browser tests cover the independent animated characters, Hindi captions, reconnection, repeated consultations, microphone recovery, accessibility and responsive layouts. Their deterministic audio transport is simulated.

`pnpm test:e2e:connected` starts the current v2 services and checks real Java session creation and persisted consent across a browser refresh. Its provider-media response is simulated so the consent smoke test does not consume Gemini audio quota.

```powershell
# Java service tests
Push-Location backend-java
.\mvnw.cmd test
Pop-Location

# Python gateway tests
uv sync --project voice-service --no-install-project
$env:PYTHONPATH = 'voice-service/src'
uv run --project voice-service --no-sync python -m unittest discover -s voice-service/tests

# Actual provider checks: require running services and consume Gemini quota
pnpm voice:smoke
pnpm voice:roundtrip
```

The provider roundtrip uses synthetic Hindi audio and creates synthetic patient/visit records. These commands describe available verification, not a promise that every test passes in every environment or revision.

## Troubleshooting and project limits

- **Microphone or audio unavailable:** allow microphone access, check the selected device and volume, and use the retry control. Remote browsers need HTTPS/WSS and reachable service URLs.
- **Voice cannot connect:** check Java/Python health, configured key/model access, network, allowed origins and provider quota.
- **Remote page loads but intake fails:** check the configured public patient API and voice URLs and their port visibility. A remote visitor's `localhost` points to their own device.
- **Java/database startup fails:** check installed binaries, `JAVA_HOME`, `HELIOS_POSTGRES_BIN`, database credentials and startup errors. Avoid duplicate services on the same ports.
- **Specialization routing needs adjustment:** routing data and backend rules determine the saved decision. The project does not offer a doctor dashboard for managing or reviewing that decision.

HELIOS is an engineering prototype for intake and referral support. It is not a clinically validated diagnosis or treatment system. Extracted facts and routing can be wrong; the saved information requires clinical review through a separately provided workflow. Accent, noise, emergencies, concurrent users and deployment behavior require evaluation beyond automated tests.

Audio is sent to Gemini. The normal gateway flow does not persist patient microphone audio, but accepted structured facts are saved. Real patient use requires appropriate consent, data governance, access controls and operational review. Native voice depends on the external Gemini service; the experimental local Human-1 adapter is not the default offline replacement.

Gemini supplies the underlying native audio model. HELIOS implements the conversation workflow, validation, routing, persistence and patient interface. Third-party dependencies retain their own licenses; this repository currently provides no root license grant.
