# HTTP API (current route inventory)

All listed routes are under `/api/v1` unless noted. JSON success is `{ "success": true, "data": ... }`; errors are `{ "success": false, "error": { "code", "message", "requestId" } }`. `GET /health` and `GET /api/v1/health` are public probes. The API sets `Cache-Control: no-store` for `/api/v1`. Binary document content is the exception to the JSON response shape.

**P** = `x-session-token`: signed patient session, server-resolved ownership. **D** = `x-doctor-token`: signed doctor session, active role and service-level patient/assignment check where relevant. **Public** = no session proof (still validated/rate-limited where shown). `DEMO` = explicit local demo flags/database plus the designated `demo.doctor` identity. Patient/doctor IDs in URLs or request bodies are never authorization by themselves. See [security](security.md). Route-specific schemas and exact DTO fields are in `apps/api/src/validation`, `apps/api/src/controllers`, and `packages/shared/src/index.ts`.

## Sessions and patient intake

| Method and path                        | Auth                        | Request / response purpose                                                        | Common failure                                     |
| -------------------------------------- | --------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------- |
| `POST /patient-sessions`               | Public; creation rate limit | `{language:"en"                                                                   | "hi"}`→ persisted session and opaque`sessionToken` | 400 invalid language, 429 throttle |
| `GET /patient-sessions/:id`            | P, matching session         | Resume session/visit state                                                        | 401/403/404                                        |
| `PATCH /patient-sessions/:id/progress` | P                           | `currentStep`, optional language/draft data; cannot client-set submitted/complete | 400/409                                            |
| `POST /patient-sessions/:id/submit`    | P                           | Server validates readiness, submits visit and returns session/token               | 400/409; retry should not duplicate check-in       |
| `POST /consents`                       | P                           | `{sessionId,consentType:"PRE_CONSULTATION",accepted:true,version:"1.0"}`          | 400/403                                            |
| `GET /patients`, `GET /patients/:id`   | P                           | Own profile only; list is at most the session's patient                           | 401/403/404                                        |
| `POST /patients`                       | P                           | `sessionId`, name, age, sex, language, optional phone → profile/visit linkage     | 400/403                                            |
| `POST /visits`, `GET /visits/:id`      | P                           | Create/read own visit                                                             | 400/403/404                                        |
| `PATCH /visits/:id/complaint`          | P                           | `chiefComplaint` and optional bounded `healthDetails`                             | 400/403                                            |

## Interview and voice

| Method and path                                                                                | Auth              | Purpose and body                                                                    | Common failure                   |
| ---------------------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------- | -------------------------------- |
| `POST /interviews`                                                                             | P                 | Start interview for owned visit (validated create body)                             | 400/403/409                      |
| `GET /interviews/:id`, `GET /interviews/:id/current-question`                                  | P                 | Resume state / server-selected question                                             | 401/403/404                      |
| `POST /interviews/:id/response`                                                                | P                 | Submit answer; schema-controlled question/answer fields                             | 400/409                          |
| `POST /interviews/:id/confirm`, `POST /interviews/:id/revise`, `POST /interviews/:id/complete` | P                 | Confirm answer, revise earlier answer, complete required history                    | 400/409                          |
| `POST /voice/transcribe`                                                                       | P; voice throttle | Multipart `audio`, `sessionId`, `language`, `durationSeconds` → transcript metadata | 400/413/422/provider unavailable |
| `GET /voice/:id`, `POST /voice/:id/edit`, `POST /voice/:id/confirm`                            | P                 | View, edit `{transcript}`, explicitly confirm own result                            | 400/403/409                      |

The default speech provider is a **mock**; setting `SPEECH_PROVIDER=openai` and a server-only key selects the optional adapter. Confirmation is required before a transcript is treated as accepted. See [voice](voice.md).

## Documents and patient timeline

| Method and path                                                                                    | Auth                 | Purpose and body                                                                  | Common failure      |
| -------------------------------------------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------- | ------------------- |
| `POST /documents`                                                                                  | P; document throttle | Multipart file plus `sessionId`, `patientId`, optional `visitId`; private storage | 400/403/413/415/409 |
| `GET /patients/:patientId/documents`                                                               | P                    | Own document list                                                                 | 403/404             |
| `GET /documents/:id`, `/documents/:id/status`, `/documents/:id/extraction`, `/documents/:id/facts` | P                    | Own metadata, processing/extraction and review facts                              | 403/404/409         |
| `GET /documents/:id/content`                                                                       | P                    | Authorized binary original/processed content; sandbox/no-store headers            | 403/404             |
| `POST /documents/:id/process`                                                                      | P                    | Run bounded OCR/extraction pipeline                                               | 409/422/503         |
| `POST /documents/:id/facts/:factId/confirm`, `/edit`, `/reject`                                    | P                    | Review one extracted fact; edit carries `{value}`                                 | 400/403/409         |
| `POST /documents/:id/identity/override`, `DELETE /documents/:id`                                   | P                    | Controlled identity review / delete own document                                  | 400/403/409         |
| `GET /patients/:patientId/timeline`, `POST /patients/:patientId/timeline/rebuild`                  | P                    | Query/filter or rebuild own source-aware projection                               | 400/403             |
| `GET /timeline/:eventId`                                                                           | P                    | Own event and permitted evidence detail                                           | 403/404             |

Document types accepted by the pipeline are PDF and supported images; the classifier's record types are prescription, lab report, discharge summary, consultation note, or unknown. The local OCR path does not read image-only scanned PDFs. See [document AI](document-ai.md).

## Doctor sign-in, workspace and comparisons

| Method and path                                                                                                                          | Auth                              | Purpose and body                                                                  | Common failure |
| ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------- | -------------- |
| `POST /doctor-sessions`                                                                                                                  | Public; login throttle, demo mode | `{username,accessCode}` → signed demo doctor proof                                | 400/403/429    |
| `GET /doctor/dashboard`, `GET /doctor/patients`                                                                                          | D                                 | Authorized metrics/search/list; dashboard supports bounded page/sort/filter query | 401/403        |
| `GET /doctor/patients/:patientId/workspace`                                                                                              | D, assigned patient               | Aggregated visit/source/queue/brief data                                          | 403/404        |
| `GET/POST /doctor/patients/:patientId/notes`, `PATCH /doctor/patients/:patientId/notes/:noteId`                                          | D; author/admin for update        | Doctor-only notes; create/update use validated content                            | 400/403/404    |
| `POST /doctor/visits/:visitId/status`                                                                                                    | D                                 | Validated visit-status transition                                                 | 400/403/409    |
| `POST /patients/:patientId/comparisons`                                                                                                  | D                                 | `{previousVisitId,currentVisitId}` → persisted deterministic comparison           | 400/403/409    |
| `POST /patients/:patientId/comparisons/quick`                                                                                            | D                                 | Choose supported visit pair through service                                       | 400/403/409    |
| `GET /patients/:patientId/comparisons`, `GET /comparisons/:id`, `GET /comparisons/:id/changes`, `GET /comparisons/:id/changes/:changeId` | D                                 | Bounded list/detail, filtered changes and source evidence                         | 400/403/404    |

## Clinical Brief and doctor verification

| Method and path                                                                                                           | Auth | Purpose and body                                                                      | Common failure |
| ------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------- | -------------- |
| `POST /patients/:patientId/briefs`                                                                                        | D    | `{visitId}` → versioned brief                                                         | 400/403/409    |
| `GET /patients/:patientId/briefs`, `GET /patients/:patientId/clinical-brief`                                              | D    | History / quick current brief (optional `visitId`)                                    | 403/404        |
| `GET /briefs/:briefId`, `/briefs/:briefId/evidence`, `/briefs/:briefId/claims/:claimId`                                   | D    | Brief, evidence and individual source-linked claim                                    | 403/404        |
| `POST /briefs/:briefId/refresh`, `/review`, `/archive`                                                                    | D    | Rebuild or change review status                                                       | 403/409        |
| `GET /verification-queue`, `GET /patients/:patientId/verification-queue`, `GET /patients/:patientId/verification-history` | D    | Bounded, filtered review queue and history                                            | 400/403        |
| `GET /verification/:verificationId`, `GET /verification/documents/:documentId`, `/content`                                | D    | Review item and authorized evidence                                                   | 403/404        |
| `POST /verification/:verificationId/{verify,correct,reject,uncertain,confirm-current,keep-previous}`                      | D    | `{expectedVersion,idempotencyKey,reason?,comment?,correctedValue?}`; immutable action | 400/403/409    |
| `POST /verification/bulk-verify`                                                                                          | D    | Bounded `reviewIds`, `expectedVersions`, `idempotencyKey`                             | 400/403/409    |

## AYUSH, languages, queue, demo

| Method and path                                                                                        | Auth                           | Purpose and body                                                                           | Common failure      |
| ------------------------------------------------------------------------------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------ | ------------------- |
| `GET/POST /patients/:patientId/ayush`                                                                  | P                              | Own AYUSH context / neutral report with system, status and original name                   | 400/403             |
| `GET/POST /doctor/patients/:patientId/ayush`, `GET /doctor/ayush/:recordId`                            | D                              | Authorized view, doctor-entered record, detail                                             | 400/403/404         |
| `GET /languages`, `GET /languages/:code`; `POST /language/detect`, `/language/normalize`, `/translate` | Public                         | Registry and bounded display/normalization utilities; English/Hindi only                   | 400/404             |
| `PUT /doctor/language`                                                                                 | D                              | `{language:"en"                                                                            | "hi"}` preference   | 400/403 |
| `POST /patient/check-in`, `GET /patient/me/queue-status`                                               | P                              | Idempotent check-in / own token, ahead count and estimate                                  | 401/403/409         |
| `GET /doctor/queue`, `POST /doctor/queue/call-next`, `/pause`, `/resume`                               | D                              | Operational queue view and controls                                                        | 401/403/409         |
| `POST /doctor/tokens/:tokenId/:action`                                                                 | D                              | Action enum: `call`, `recall`, `start`, `complete`, `skip`, `no-show`, `cancel`, `requeue` | 400/403/409         |
| `GET /demo/state`                                                                                      | Explicit local demo flags      | Non-PHI latest successful reset ID for client refresh                                      | 403 outside demo    |
| `POST /demo/reset`                                                                                     | DEMO; doctor mutation throttle | `{confirmation:"RESET SIH DEMO"}` → reset ID, `READY`/validation; CLI pipeline             | 400/401/403/409/503 |

There is **no SafetyEngine trigger/evaluation route**. In-process throttles are not distributed, and the demo reset endpoint is not a production administration interface. See [Phase 21](phase21-demo-reset.md).
