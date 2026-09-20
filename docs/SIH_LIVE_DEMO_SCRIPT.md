# HELIOS — SIH live demo operator script

This is a **synthetic prototype demonstration**. The target sequence is not a verified all-browser end-to-end test; rehearse it on the presentation machine. No SafetyEngine output is available. Do not show the private doctor access code. For detailed recovery see [failure plan](SIH_DEMO_FAILURE_PLAN.md).

## Preflight (before judges enter)

1. Confirm the local `.env` targets **only** `helios_sih_demo`, contains explicit demo flags, and has no real patient data. Stop any ongoing demo interactions. Run `pnpm demo:reset`, then `pnpm demo:verify`; expect the strict synthetic baseline, including 12 patients, 13 visits, 3 documents and six A-series tokens. If verification fails, do not present it as ready.
2. Start `pnpm demo:dev`; open [patient demo](http://localhost:3000/sih-demo). Require backend and database **up**. Keep patient and doctor in distinct browser contexts. The doctor signs in as `demo.doctor` using the private code from `.env`, off screen.
3. Prepare only synthetic input. Optional document: `dataset/documents/phase6-fixtures/demo-current-lab-report.pdf`. Know that Aarav Sharma is **preseeded** with initial token A-001; a newly submitted patient receives a separate token from the backend.

| # | Action | What to say | Judge should notice / expected result | Fallback |
| - | - | - | - | - |
| 1 | Open `/sih-demo`; show connected status and synthetic notice. | “Both experiences use one connected API and synthetic records.” | Backend/database status is up; no patient data. | If down, restart services; do not claim live state. |
| 2 | Enter patient experience; select Hindi and consent. | “The patient chooses the language before sharing clinical information.” | Hindi UI and consent gate. | If Hindi UI fails, disclose and use English. |
| 3 | Type `Mujhe teen din se bukhar hai aur body pain bhi hai.` in the complaint field. If microphone is pretested and configured, it may be shown, but confirm/edit its transcript. | “Natural wording is kept; this is typed synthetic input.” | Original phrasing remains distinguishable from structured facts. | Use text if microphone/STT fails; never call typed text “live transcription.” |
| 4 | Answer a genuine follow-up question and, where allowed, select “I don't know.” | “The interview advances from persisted state; unknown is not ‘no’.” | A real next question and explicit uncertainty. | Rules default is supported; if flow fails, show error and switch to preseeded context with disclosure. |
| 5 | Optional: upload the synthetic PDF and inspect candidate/evidence review. | “A document proposes evidence-linked facts; it does not certify them.” | Processing/review status; original source available. | If OCR/upload fails, say so and later show **preseeded** Aarav evidence. Do not attribute it to this upload. |
| 6 | Review then submit once; show token/waiting state. | “This token was allocated by the queue service.” | Backend-issued token and position/status. | Diagnose API/db failure; never show a hardcoded token as a live result. |
| 7 | Switch to separate doctor context; sign in privately and open queue. | “The doctor workspace is separately authorized.” | Same submitted patient appears in backend queue. | If new patient delayed, disclose and open preseeded Aarav (A-001). |
| 8 | Call the intended named row, then show patient waiting page after its next poll/refresh. | “A doctor action changes persisted queue state.” | CALLED/Your turn on both screens. | Use named-row Call if Call Next chooses someone else; if polling stalls, refresh and say it refreshed. |
| 9 | Open the actual patient workspace; for richer longitudinal context use **preseeded Aarav**, explicitly announcing the switch. Show Clinical Brief, timeline and What Changed. | “The brief and comparison organize source-linked history; this richer record is preseeded.” | Prior/current distinction and provenance. | If one view fails, show the error and only the functioning evidence view. |
| 10 | Open document evidence and Verification Center; verify/correct/reject/mark uncertain one appropriate fact. | “The doctor checks original evidence and remains the decision-maker.” | Persisted doctor action/history; not an AI decision. | If action fails, stop and disclose; do not claim it saved. |
| 11 | If appropriate, start/complete consultation using allowed queue transitions. Close. | “HELIOS does not diagnose or prescribe. It gives the doctor a clearer story before consultation. Turn patient waiting time into clinical intelligence.” | Human-control boundary and backend state. | If transition unavailable, close on verification and state what was not completed. |

**Safety line to say plainly:** “The clinical SafetyEngine is not implemented in this build; this priority-review queue badge is not an automated clinical alert.” Never demo a fabricated risk rule. 

