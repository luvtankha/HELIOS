# HELIOS — SIH presentation master (8–10 minutes)

Positioning: **Turn patient waiting time into clinical intelligence.** Use this file as the editable content and speaker-note source for the deck. The slide is a visual prompt, not a transcript. Status labels below are part of the presentation: **Now** means implemented prototype behavior; **Next** means unimplemented or unvalidated work.

| # | Headline and on-slide content | Speaker notes: say / avoid / likely question |
| - | - | - |
| 1 | **HELIOS** · Turn patient waiting time into clinical intelligence · Patient → doctor-ready context | Say: a consented pre-consultation workflow. Avoid: “AI doctor.” Question: What does HELIOS stand for? Healthcare Enabled Language & Intelligent Observation System. |
| 2 | **The story arrives fragmented** · Waiting time goes unused · Narratives, old reports and language barriers separate context · Doctor reconstructs it during consultation | Say: qualitative workflow problem; no measured prevalence or time saved. Avoid invented statistics. Question: Is this a real hospital study? No. |
| 3 | **Forms collect answers; clinicians need context** · One-off fields miss chronology · Documents need source review · The difference from a prior visit is not obvious | Say: a workflow contrast, not a claim against every existing EHR/form. Avoid competitor comparisons. Question: Why not a form? The linked longitudinal and verification workflow. |
| 4 | **Intake becomes a doctor-ready brief** · Consented patient input · Source-labelled facts · Timeline + What Changed + brief · Doctor verifies | Say: patient and doctor route trees share an API, not UI privileges. Avoid autonomous clinical conclusions. Question: What is AI doing? Bounded speech/NLU/OCR adapters; deterministic core. |
| 5 | **The patient speaks naturally** · Choose English/Hindi and consent · Speak or type; answer adaptive questions · Review document candidates · Submit → token → wait | Say: Hinglish is bounded normalization, not broad language coverage. Default speech is mock; text is a reliable demo path. Question: Does the microphone always work? No; typed fallback is explicit. |
| 6 | **A transparent processing pipeline** · Confirmed text → interview/facts · Optional document → evidence candidates · Timeline / comparison / brief · Doctor review | Say: default NLU is rules; OCR mock or local. No active SafetyEngine. Avoid calling deterministic services an autonomous AI model. Question: What controls hallucination? Schemas, provenance, review—not elimination. |
| 7 | **The doctor sees the story, not just a transcript** · Authorized queue · Clinical Brief + What Changed · Timeline + document evidence · Verify/correct/reject/uncertain | Say: doctor actions persist, and patient cannot fetch doctor-only responses. Avoid measured efficiency claim. Question: Can the doctor disagree? Yes; verification is explicit. |
| 8 | **Innovation is the connected workflow** · Multilingual pre-consultation intake · Evidence and longitudinal context · Operational token/queue · Human verification | Say: this is an architectural combination, not an unbenchmarked superiority claim. Question: Why not a chatbot? Chat alone lacks persisted evidence, comparisons and accountable verification. |
| 9 | **Clinical authority stays with the doctor** · HELIOS collects and structures · Rules control workflow, not treatment · Doctor checks source evidence and decides · **SafetyEngine: Next, not live** | Say: no diagnosis, prescription, emergency screening or “all clear.” Queue priority badge is not a clinical alert. Question: What if AI is wrong? Show original evidence, uncertainty and doctor correction. |
| 10 | **One backend, two protected experiences** · Next.js patient/doctor routes · Express API with signed proofs + object checks · Prisma/PostgreSQL + private local storage · Optional provider adapters | Say: not two deployed frontend apps; polling, not WebSockets. Question: How do they communicate? Independently via authorized HTTP API. |
| 11 | **Language and AYUSH stay source-aware** · English and Hindi active · Original wording beside normalized terms · AYUSH system/treatment/timing captured · No biomedical equivalence inference | Say: bounded Hinglish and glossary support, not clinically certified translation. Question: Other languages? Future evaluation. |
| 12 | **Documents add evidence, not automatic truth** · Validated PDF/image upload · Mock or local OCR · Conservative extraction + page evidence · Patient review, then doctor verification | Say: local PDF text extraction; English-oriented image OCR. Scanned image-only PDFs and handwriting unverified/unsupported. Question: What if OCR is wrong? Preserve source and reject/correct candidate. |
| 13 | **Before → current → difference** · Source-labelled timeline · Visit snapshot comparison · Short Clinical Brief · Clinician reviews the underlying evidence | Say: What Changed is deterministic comparison, not diagnosis. Question: Conflicting records? Keep them visible for review. |
| 14 | **The queue makes intake operational** · Patient submits and receives backend token · Doctor calls/starts/completes · Patient sees polled status · No clinical triage inference | Say: A-001 is the reset golden patient's real seeded token, not a promised token for a newly submitted patient. Question: Real-time? Polling about every eight seconds. |
| 15 | **Access is checked at the API** · Signed patient/doctor proofs · Role and object authorization · Validated input + restricted document route · Demo reset isolated to synthetic database | Say: prototype controls, not compliance certification. Demo doctor login is not production IdP/MFA. Question: Can one patient open another record? Ownership checks deny it; dedicated tests cover this boundary. |
| 16 | **Live demo: follow one record** · Hindi consent/text → questions · Optional synthetic document → review · Submit/token → doctor queue · Brief/change/evidence → verification | Say: disclose when switching to preseeded Aarav; default providers are mocks/rules. No live SafetyEngine step. Question: What if a service fails? Use the labelled fallback plan, never fake success. |
| 17 | **Now is a prototype. Next is clinical readiness.** · **Now:** intake, provenance, timeline, comparison, brief, queue, verification · **Next:** clinician-approved SafetyEngine, identity/retention, provider evaluation, full browser rehearsal · Potential impact needs measurement | Say: no real customers, outcomes, accuracy or savings are established. Question: Can hospitals deploy it now? Not as a clinically validated production system. |
| 18 | **A clearer story before the consultation** · The doctor remains the decision-maker · Turn patient waiting time into clinical intelligence | Say the closing exactly. Avoid promising a measured result. Ask judges to follow the evidence from patient input to doctor review. |

## Architecture diagrams

The six presentation-ready Mermaid diagrams, including the implemented/future boundary, are in [SIH_PRESENTATION_DIAGRAMS.md](SIH_PRESENTATION_DIAGRAMS.md). Slide 10 uses Product Architecture, slides 5–7 the patient/AI/doctor flows, slide 15 the security boundary, and slide 16 the demo flow. The deck uses simplified editable shapes; this document is the detailed diagram source.

## Technology stack — verified prototype

| Layer | Current | Optional / next |
| - | - | - |
| Frontend | Next.js 15, React, Tailwind, TypeScript; one deployment, separate route trees | Independently deployed clients not current |
| Backend | Express 5, Zod, Pino, deterministic domain services | Distributed workers not current |
| Database | PostgreSQL, Prisma 6 | Multi-tenant/scale architecture not established |
| Speech / language | Mock STT, rules NLU, English/Hindi registry and bounded Hinglish normalization | Configurable OpenAI STT/NLU; broader evaluation needed |
| OCR / documents | Mock OCR; local PDF.js text/Tesseract.js image OCR; private local storage | Object storage and broader formats not current |
| Updates | HTTP polling | WebSockets/SSE not current |
| Security | Signed session proofs, RBAC/object checks, validation, local rate limiting, audit records, guarded synthetic reset | Production IdP/MFA, distributed controls, retention, certification |
| Tests | Vitest, Testing Library, Supertest, Playwright | Clinical evaluation and full end-to-end rehearsal remain |

## Claim boundary

This pitch does **not** assert clinical benefit, diagnostic accuracy, time saved, hospital adoption, production deployment, certification, or a working SafetyEngine. [Claim register](SIH_CLAIM_VERIFICATION.md) maps the claims used here to current sources.

