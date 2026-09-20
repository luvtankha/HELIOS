# HELIOS SIH judge demonstration — fast path

**Positioning:** “HELIOS turns patient waiting time into structured clinical intelligence for the doctor.” The AI assists; the doctor remains the final clinical authority. This is a synthetic workflow demonstration, not a diagnosis or treatment recommendation.

## Operator preflight

1. Use the dedicated local PostgreSQL `helios_sih_demo` database and the ignored root `.env`. Do not use the ordinary `helios` database or a production endpoint.
2. Stop active demo sessions; run `pnpm demo:reset`, then `pnpm demo:verify`. The guarded reset must report 12 patients, 13 visits, 3 documents, 6 queue tokens, and the golden patient present. It refuses production and non-demo databases.
3. Run `pnpm demo:dev`; open `http://localhost:3000/sih-demo`. Confirm “Backend: up · Database: up”. If either is unavailable, stop—do not claim a successful clinical operation.
4. Keep a separate patient browser context and doctor browser context. The local doctor ID is `demo.doctor`; enter the private `DOCTOR_DEMO_ACCESS_CODE` without showing it on screen.
5. Have the original synthetic PDF at `dataset/documents/phase6-fixtures/demo-current-lab-report.pdf` ready. Do not use a real record or recording.

The timed path is a presentation target, not an automated timing guarantee. The connected browser test verifies live queue, brief, verification and completion, but it creates the patient intake through the API; the complete browser-driven interview and document path remains an open QA gate.

## Approximately 3 minutes

| Time  | Say                                                                                    | Click / show                                                                                                                 | Judge should notice                                                           | Safe fallback                                                                                                    |
| ----- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 00:00 | “The patient shares their story while waiting; the doctor gets a source-linked brief.” | Open `/sih-demo`; show live readiness and synthetic-data notice.                                                             | One real backend and database serve both apps.                                | If disconnected, restore the backend; do not show fabricated results.                                            |
| 00:15 | “The patient can begin in Hindi.”                                                      | Patient experience → Hindi → consent.                                                                                        | Language and consent precede clinical capture.                                | Use English only if Hindi UI is unavailable; state the limitation.                                               |
| 00:25 | “They describe a complaint in their own words.”                                        | Enter synthetic details and type “Mujhe teen din se bukhar hai aur body pain bhi hai.”                                       | Original wording is preserved.                                                | Use text if microphone or STT is unavailable; label it as typed synthetic input.                                 |
| 00:45 | “The next question follows the actual interview state.”                                | Answer a real adaptive question; use `Pata nahi` once where accepted.                                                        | UNKNOWN is not silently converted to NO.                                      | If interview provider fails, use the configured rules fallback; do not skip to a fabricated answer.              |
| 01:00 | “Documents remain evidence, not automatic truth.”                                      | Upload the synthetic lab PDF through the patient document UI and show processing/review.                                     | Extraction has source evidence and a verification state.                      | If live OCR fails, open the preseeded Aarav document later and say live OCR was unavailable.                     |
| 01:20 | “The patient reviews before submission.”                                               | Review and submit once; show the real token and waiting page.                                                                | Token comes from the queue backend.                                           | If submission fails, resolve the API/database issue; do not display a hardcoded token.                           |
| 01:40 | “The doctor sees the same operational queue.”                                          | Separate doctor session → sign in → full queue.                                                                              | Doctor UI is separate and authorized.                                         | Use the seeded Aarav workspace if live intake is delayed, and disclose the switch.                               |
| 01:50 | “Calling changes the patient’s live state.”                                            | Call the live patient or use Call Next when its server ordering selects the intended token; refresh patient waiting.         | Patient sees “Your turn” from backend state.                                  | If the wrong token is next, use the named row’s Call action; do not claim Call Next selected the golden patient. |
| 02:00 | “Here is the clinical story, with its sources.”                                        | Open Aarav or the submitted patient; show Clinical Brief.                                                                    | Brief is generated from persisted facts, not a hardcoded demo card.           | If brief unavailable, show the explicit error and continue only with verified views.                             |
| 02:20 | “HELIOS organizes prior versus current information.”                                   | Open What Changed and timeline. State that SafetyEngine is **unavailable** in this build.                                    | Change classification is deterministic; queue priority is not a safety alert. | Never assert a rule-derived safety signal.                                                                       |
| 02:35 | “The doctor checks evidence before accepting a fact.”                                  | Open a synthetic document and Verification Center; inspect the original source.                                              | Extracted/patient-reported content needs doctor judgment.                     | Use an existing seeded evidence item if live upload did not process.                                             |
| 02:50 | “The doctor remains accountable.”                                                      | Perform one appropriate Verify/Correct/Reject/Uncertain action, then start/complete consultation using allowed queue states. | Verification history and completion persist in PostgreSQL.                    | If an action fails, show its error and stop; never pretend it saved.                                             |

## Exact run commands

```powershell
pnpm demo:migrate
pnpm demo:reset
pnpm demo:verify
pnpm demo:dev
```

Open `http://localhost:3000/sih-demo`. The presenter panel is at `/doctor/sih-demo` behind the demo doctor sign-in. Phase 21 added a confirmation-protected Reset Demo button there; `pnpm demo:reset` remains the guarded CLI recovery path.

## Claims to avoid

- No autonomous diagnosis, treatment, clinician replacement, or clinical validation claim.
- No claim that queue `PRIORITY_REVIEW` is a SafetyEngine finding.
- No claim that live microphone, OCR, full browser intake, or the exact three-minute sequence passed end to end until those steps are personally rehearsed and tested on the presentation machine.
