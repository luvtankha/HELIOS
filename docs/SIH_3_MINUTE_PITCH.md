# HELIOS — three-minute pitch

Timing is a rehearsal target, not a measured result. Prioritize the demo if the event imposes a shorter slot.

## 0:00–0:30 — The problem

“Before a doctor can assess a patient, someone must reconstruct the story. The patient repeats symptoms, dates, medicines and prior reports; the doctor has to connect those pieces during the consultation. The waiting period is available, but the clinical context is often still scattered when the patient is called.”

## 0:30–1:15 — The solution

“HELIOS turns waiting time into clinical intelligence. With consent, a patient uses the patient experience in English or Hindi, speaks or types naturally, answers follow-up questions, reviews any document-derived facts, and checks in. The token is created by the backend—not by a demo animation. Doctor and patient screens are separate route trees in one web deployment, backed by the same authorized API and PostgreSQL database.”

## 1:15–2:15 — How it works

“The interview engine chooses questions deterministically. Optional speech or language providers are bounded adapters, while the default demo uses mocks and rules. Validated answers and document candidates keep their original wording, normalized representation, and source evidence. A timeline shows prior context; What Changed compares visit snapshots; a short Clinical Brief points the doctor to relevant information. The doctor then reviews the original evidence and explicitly verifies, corrects, rejects or marks facts uncertain. Queue status changes are persisted and shown through polling.”

## 2:15–2:45 — Difference and safety boundary

“This is more than a chatbot or an OCR screen: intake, document evidence, longitudinal context, queue workflow and doctor verification connect in one record. The key boundary is equally important. HELIOS does not diagnose, prescribe or decide treatment. The clinical SafetyEngine requested in the roadmap is not implemented, so we do not claim automated emergency screening or a reassuring ‘no risk’ result.”

## 2:45–3:00 — Close

“The potential benefit is a clearer, source-linked story before the consultation; clinical or time-saving outcomes have not been measured. HELIOS does not replace the doctor. It gives the doctor a clearer story before the consultation begins. Turn patient waiting time into clinical intelligence.”

