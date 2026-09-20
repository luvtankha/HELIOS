# HELIOS Phase 3 Completion Report

Date: September 9, 2026

## 1. Files changed

Principal Phase 3 additions and updates:

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260908020000_voice_interactions/migration.sql`
- `apps/api/src/providers/` — provider contract, mock adapter, OpenAI adapter, factory
- `apps/api/src/controllers/voice-controller.ts`
- `apps/api/src/routes/voice.ts`
- `apps/api/src/services/voice-service.ts` and `voice-services.ts`
- `apps/api/src/repositories/voice-interaction-repository.ts`
- `apps/api/src/security/session-proof.ts`
- `apps/api/src/middleware/audio-upload.ts`
- `apps/api/src/validation/voice.ts`
- `apps/api/src/serializers/voice.ts`
- `apps/web/src/hooks/use-voice-recorder.ts`
- `apps/web/src/lib/voice-machine.ts`
- `apps/web/src/services/voice-service.ts`
- `apps/web/src/app/patient/listening/page.tsx`
- `apps/web/src/components/patient/voice.tsx`
- Shared DTOs/language configuration, environment configuration, tests, README, and architecture/security/domain/product documentation

## 2. Architecture

The browser requests microphone access and records through `MediaRecorder` using mono, echo-cancelled, noise-suppressed audio at a restrained bitrate. A Web Audio analyser drives a local amplitude display; audio is not uploaded for visualization.

One reducer owns the complete client state model: `IDLE`, `PERMISSION_REQUEST`, `READY`, `RECORDING`, `STOPPING`, `UPLOADING`, `TRANSCRIBING`, `TRANSCRIBED`, `AWAITING_CONFIRMATION`, `EDITING`, `CONFIRMED`, and `ERROR`.

The client sends one bounded multipart upload through `voiceService`. The API validates the session proof, server-side session, language, multipart shape, claimed MIME type, byte signature, size, and duration before calling the configured `SpeechProvider`. Provider output is normalized into a provider-neutral result and persisted without raw audio.

## 3. Speech providers used

`MockSpeechProvider` is the default. It supports deterministic English and Hindi demonstrations without an external speech service.

`OpenAISpeechProvider` is the implemented real adapter. It calls `POST /v1/audio/transcriptions`, supplies the selected ISO-639-1 language, uses a configurable model and timeout, and normalizes text, detected language, and optional log-probability-derived confidence. This request shape follows the [official OpenAI audio transcription API reference](https://developers.openai.com/api/reference/resources/audio).

No provider-specific code is present in React components, controllers, or patient-flow services.

## 4. API endpoints

- `POST /api/v1/voice/transcribe` — bounded multipart audio transcription
- `GET /api/v1/voice/:id` — retrieve an owned interaction
- `POST /api/v1/voice/:id/edit` — preserve original text and save a patient edit
- `POST /api/v1/voice/:id/confirm` — explicitly save the accepted transcript

Voice endpoints require `x-session-token`. The token is an HMAC-backed opaque proof issued with a new patient session. Interaction ownership is checked on every read or mutation. The visit association is derived from the verified server-side session rather than trusted from the client.

## 5. Database changes

Added `VoiceInteraction` and `VoiceInteractionStatus`. The entity records session, optional visit, selected/detected language, minimal audio metadata, original transcript, optional normalized transcript, patient-edited transcript, accepted transcript, optional confidence, internal provider/model provenance, status, and timestamps.

Retries create separate interaction records. Original text is never overwritten by normalization or editing. Audio metadata records `retained: false`; HELIOS processes the uploaded buffer in memory and does not persist raw audio.

The incremental migration is generated and the Prisma schema validates. Migration deployment was attempted but could not run because no PostgreSQL server is available at `localhost:5432`. No claim is made that the migration was applied.

## 6. Environment variables

- `SPEECH_PROVIDER=mock|openai`
- `SPEECH_API_KEY`
- `SPEECH_MODEL` (default `gpt-4o-mini-transcribe`)
- `SPEECH_TIMEOUT_MS` (default `30000`)
- `VOICE_MAX_DURATION_SECONDS` (default `75`)
- `VOICE_MAX_FILE_BYTES` (default `8000000`)
- `SESSION_TOKEN_SECRET` — must be replaced in production
- `NEXT_PUBLIC_VOICE_MAX_DURATION_SECONDS`
- `NEXT_PUBLIC_VOICE_MAX_FILE_BYTES`

Client limits improve UX; server limits remain authoritative. A production startup using the known local session secret is rejected by environment validation.

## 7. Tests

- API/shared behavior: 33 passed
- Web behavior: 14 passed
- Total: 47 passed
- Live PostgreSQL integration: 4 skipped because `TEST_DATABASE_URL` is absent

Coverage includes the provider contract, English/Hindi mock output, separate Hindi normalization, real-adapter response normalization, success/failure, ownership, MIME/field validation, maximum duration, retry history, original/edit/accepted preservation, API validation, state transitions, unsupported-browser behavior, microphone denial, text fallback, and existing Phase 0–2 regression coverage.

## 8. Type-check and static quality

- Strict TypeScript: passed across shared, API, web, Prisma seed, scripts, and configuration
- ESLint: passed with zero warnings
- Prettier check: passed
- Prisma schema validation: passed
- Prisma client generation: passed

## 9. Build

The production build passed. Next.js generated all 13 application pages, including the patient voice flow, and the shared and API TypeScript builds completed successfully.

## 10. Manual test results

- Desktop voice-entry layout: passed visual inspection
- 768 px tablet: no horizontal overflow
- 320 px mobile: no horizontal overflow and no visible button/link below the 44 px target threshold
- Patient flow with a local synthetic QA session: reached the real voice entry page
- Microphone initiation: reached the `Opening your microphone…` permission-request state
- Device permission acceptance and real recording: not performed because granting microphone access requires explicit device-level approval
- Text fallback: visible in the live UI; editor transition is covered by the web test
- English/Hindi transcription, retry, edit, confirmation, network/provider failure, and permission denial: passed automated tests
- Default mock provider: passed automated contract and pipeline tests
- OpenAI adapter: request/response behavior passed with a stubbed provider response; no live API call was made because no speech API key was supplied

## 11. Known issues

- A live PostgreSQL database is required to apply the migration and persist real interactions.
- A live OpenAI transcription has not been exercised in this environment because no API key was available.
- Physical microphone capture still requires validation on the target kiosk/mobile browsers with a user granting device permission.
- Browser-declared duration is checked in addition to hard byte limits, but production deployments should consider server-side media-duration inspection if adversarial uploads are in scope.
- Phase 2 sessions created before session proofs existed cannot use voice after resume; the UI asks the patient to restart the session.
- Authentication is still a session-proof boundary for the patient flow, not a production identity system.

## 12. Future limitations and boundary

Phase 4 was not started. The existing fixed follow-up questions remain a non-adaptive demonstration after transcript confirmation.

Not implemented: diagnosis, medical recommendations, red-flag or risk logic, adaptive clinical reasoning, OCR/document intelligence, doctor dashboard, AYUSH reasoning, FHIR/ABDM, speech synthesis, streaming transcription, permanent audio storage, or additional Indian-language adapters.

To run Phase 3 locally:

```powershell
Copy-Item .env.example .env
# Configure DATABASE_URL and start PostgreSQL.
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Keep `SPEECH_PROVIDER=mock` for an offline SIH demonstration. To exercise the real adapter, set `SPEECH_PROVIDER=openai`, add `SPEECH_API_KEY`, and restart the API.
