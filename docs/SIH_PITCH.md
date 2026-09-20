# HELIOS SIH pitch and demo narrative

## 30 seconds

“HELIOS turns patient waiting time into structured, source-aware clinical preparation. Patients consent, speak or type, review their information, and receive a queue token. Doctors open a separate authorized workspace that brings together the current concern, history, documents, changes, and evidence for verification. HELIOS does not diagnose or prescribe—the doctor remains in control.”

## One minute

Show the patient start, consent/language, one interview answer and review. Explain that speech/OCR are optional provider adapters and defaults are mocks/rules in the demo. Submit to generate a backend token. Switch to the doctor queue, open the patient, show provenance/evidence, What Changed and the Clinical Brief, then perform one explicit doctor verification. State plainly that updates poll the shared API and that SafetyEngine rules are not implemented.

## Three-minute demo

1. **0:00–0:35:** `/sih-demo`—problem, synthetic-data notice, connected-service status.
2. **0:35–1:15:** Patient language/consent/details/complaint; use text fallback if microphone is unreliable.
3. **1:15–1:40:** Review and submit; show the real token/waiting estimate.
4. **1:40–2:20:** Doctor login/queue; call the patient and show the patient's polled “Your turn” state.
5. **2:20–2:50:** Golden patient workspace: source labels, document evidence, timeline, What Changed, short brief.
6. **2:50–3:00:** Verify one fact; close with the human-control and safety boundary.

If a live provider/upload fails, disclose it and use typed or clearly labelled preseeded synthetic evidence. Never attribute seeded output to a failed live action. Reset between judges from protected presenter controls; success validates the supported synthetic baseline only.

## Technical and innovation explanation

One Next.js app separates patient and doctor route trees; both call an Express API that enforces signed sessions, role/object checks and Zod schemas. Services persist through Prisma/PostgreSQL and private document storage. Innovation is the combination of consented waiting-time intake, provenance-aware longitudinal organization, deterministic comparison/brief generation and explicit doctor verification. Queue changes are backend state transitions and polling—not a fake card or WebSocket claim.

## Expected impact, stated responsibly

HELIOS aims to reduce repetitive collection and help clinicians find relevant, source-linked information faster. The repository does not establish measured clinical outcomes, diagnosis accuracy, regulatory compliance or production readiness. A clinician must review source evidence and make every clinical decision.
