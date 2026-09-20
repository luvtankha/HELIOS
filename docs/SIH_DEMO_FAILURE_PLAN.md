# HELIOS — honest live-demo recovery plan

Always announce a failed step and distinguish **live output**, **typed fallback**, and **preseeded synthetic evidence**. Do not use a screenshot or fixture as proof that a failed provider succeeded. Stop the live clinical flow if backend/database integrity is in doubt.

| Failure | Immediate check | Supported fallback and truthful line |
| - | - | - |
| Microphone / permission | Device permission, input choice, browser recorder state | Type the same synthetic complaint. “The microphone is unavailable; I am using the supported text path.” |
| Internet / remote provider | Is local API still up? Does optional provider fail? | Local rules/mock demo can run without the remote provider if services remain up. “Remote AI is unavailable; this is the deterministic fallback.” If app/backend network is down, pause rather than fake a flow. |
| AI/NLU provider | Look for explicit provider/fallback state and interview response | Use configured rules fallback; do not claim a live model interpreted the text. |
| OCR / document processing | Check upload status and explicit processing error | Show **preseeded Aarav** document evidence with a label. “This document was seeded before the demo; the live upload failed.” |
| Slow response | Wait for actual UI state; check API health | Explain polling and refresh once. If no persisted result appears, skip that claim. |
| Browser refresh / stale session | Reopen `/sih-demo`, check patient/doctor session state | Resume from persisted state if available. A demo reset invalidates stale patient tabs; start fresh only after strict verify. |
| Queue update failure | Inspect actual queue row and patient status after polling/refresh | Use named-row Call if ordering differs. If no persisted transition, do not claim the patient was called. |
| Document upload failure | Verify file is synthetic, PDF/image type, allowed size and API/storage availability | Continue without live upload; use preseeded source only with disclosure. Do not upload real records. |
| Demo reset failure | Read presenter error; run guarded CLI `pnpm demo:reset`, `pnpm demo:verify` against local demo DB only | Present only after `READY` / strict verification. Reset can be partially complete across filesystem and DB; a 503 is not success. |
| Clinical safety question | Check [safety boundary](safety.md) | “No clinical SafetyEngine is implemented; a doctor independently evaluates urgency.” Never use queue priority as a medical finding. |

The protected `/doctor/sih-demo` Reset Demo button is confirmation-gated and only available in explicit local synthetic mode. Reset is destructive for demo-linked records; never run against non-demo data. See [Phase 21 reset](phase21-demo-reset.md).

