# HELIOS SIH five-minute deep dive

This extends [the fast presenter script](SIH_DEMO_SCRIPT.md). All showcase records are synthetic. The demo uses the real Patient App → HELIOS API → PostgreSQL ← Doctor Dashboard architecture; navigation links do not mutate clinical state.

## 0:00–1:00 — patient, consent, multilingual intake

Open `/sih-demo` and confirm the live backend/database badge. Open the patient experience in a separate context. Select Hindi, accept consent, enter fictional details, then type or speak a Hindi/Hinglish complaint. Show the accepted text before moving on. If microphone/STT is unavailable, use the clearly described text path; do not call typed input a recording. Answer a real adaptive question and show that an unknown answer remains unknown. The rules-based clinical NLU fallback is configured in the local demo profile; external AI is not required.

## 1:00–2:00 — document and token

Upload `dataset/documents/phase6-fixtures/demo-current-lab-report.pdf` through the patient UI. Show processing status, extracted fields and source evidence only if the live Phase 6 pipeline returns them. If it fails, say so and later use the preseeded synthetic document in Aarav’s doctor workspace; never pass preseeded extraction off as this upload’s result. Review the patient answers, submit through the normal flow, and show the real token, patients ahead, and waiting status.

## 2:00–3:00 — separate doctor workspace and synchronization

Sign in as `demo.doctor` using the private operator-selected code. Use the live queue, not a screenshot. The seeded queue includes six synthetic tokens; Aarav is the golden patient. `Call Next` follows backend ordering and may select a different token than Aarav. To demonstrate one specific patient, use that row’s `Call` action and state why. In the patient context, refresh or wait for polling and show “Your turn”. Both views reflect a persisted queue transition.

## 3:00–4:15 — source-linked clinical review

Open Aarav from the authorized presenter panel or queue. His seeded record has two visits, Hindi/Hinglish text evidence, documents, medications, allergy information, timeline entries and one prior verification. Open the live Clinical Brief; do not claim its narrative is a diagnosis. In What Changed, select Aarav and compare previous/current visits; inspect previous/current values, classifications and evidence. Open the timeline and the synthetic document page. A seeded patient/document discrepancy should be framed as **information requiring review**, not a medical conclusion.

The current build has no Phase 5 SafetyEngine. The doctor workspace intentionally says safety is unavailable. A queue priority label is operational metadata, not a deterministic clinical rule result. Omit a claimed safety-signal demonstration until a clinician-approved, versioned SafetyEngine exists and is tested.

## 4:15–5:00 — verification and completion

In Verification Center, open a source-linked fact and choose one defensible action. `Verify` confirms a recorded fact; `Correct`, `Reject` and `Mark uncertain` must reflect the evidence actually shown. Confirm the action and refresh the patient workspace or verification history. Then start and complete the consultation using the real queue controls. Explain that HELIOS prepares information and the clinician decides what it means.

## Repeatability, security, and recovery

- `pnpm demo:reset` clears only `DEMO-*` patients from the dedicated local demo database, reseeds the golden records and re-verifies counts. Stop active sessions before running it. The guard refuses production, non-demo databases and any database containing non-demo patients.
- `pnpm demo:verify` queries actual database counts; it is not a UI-only status card.
- The presenter guide requires a signed doctor session. It offers navigation, not bypasses of consent, RBAC, queue transitions or verification.
- The live readiness indicator reports API and database connectivity only. It does **not** certify STT, OCR, AI, or SafetyEngine readiness.
- If the database is down, stop clinical actions. If an external provider is down, use the explicit text/rules path or disclose use of preseeded evidence. Never fabricate a successful operation.
- For recording/screenshots, use the real `/sih-demo`, `/patient` and `/doctor` screens with synthetic records. Hide the terminal and private access code; leave the demo badge visible.

## Current verification boundary

The automated connected browser suite passes entry, doctor authentication, live golden-patient lookup, a Hindi patient created through API intake, waiting/call synchronization, Clinical Brief, one doctor verification saved to PostgreSQL, and consultation completion. It does **not** yet prove the complete browser-driven patient interview plus live document upload/OCR, every What Changed interaction, or an actual rule-derived SafetyEngine signal. The final SIH demonstration must be rehearsed on the presentation machine before any complete-demo claim.
