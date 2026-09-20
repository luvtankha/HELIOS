# HELIOS — SIH claim verification register

“Verified” means supported by this repository or its documented local tests; it does **not** mean clinically validated or independently audited. “Qualified” requires the stated limitation wherever used. Pitch and slide numbers refer to [master presentation](SIH_PRESENTATION.md). No real-world time/cost/outcome or diagnostic-performance numbers are used.

| Claim | Source | Verified? | Where used |
| - | - | - | - |
| Positioning: waiting time → clinical intelligence | [`SIH_README.md`](SIH_README.md), product flow | Yes, positioning (not outcome metric) | All pitches, slides 1/18 |
| One Next.js deployment has separate patient/doctor route trees, one Express API and PostgreSQL | [`architecture.md`](architecture.md), `apps/web/src/app`, `apps/api/src`, Prisma schema | Yes | 3-minute pitch, slides 4/10 |
| Patient consent, English/Hindi UI and text intake | [`patient-flow.md`](patient-flow.md), [`multilingual.md`](multilingual.md) | Yes; bounded Hinglish only | Pitches, slide 5 |
| Speech and clinical NLU | [`ai-architecture.md`](ai-architecture.md), [`voice.md`](voice.md) | Qualified: mock/rules defaults; optional OpenAI adapters | Pitches, slides 5/6 |
| Deterministic interview and source-labelled facts | [`ai-architecture.md`](ai-architecture.md), [`architecture.md`](architecture.md) | Yes, prototype | Pitches, slides 4/6 |
| PDF/image document candidates and evidence | [`document-ai.md`](document-ai.md) | Qualified: mock/local OCR; scanned image-only PDFs, handwriting and accuracy unverified | Slides 6/12/16, demo |
| Timeline, What Changed and Clinical Brief | [`timeline.md`](timeline.md), [`what-changed.md`](what-changed.md), [`clinical-brief.md`](clinical-brief.md) | Yes, deterministic prototype | Pitches, slides 7/13 |
| Explicit authorized doctor verification and audit history | [`verification.md`](verification.md), [`doctor-workspace.md`](doctor-workspace.md) | Yes, prototype | Pitches, slides 7/9/16 |
| AYUSH capture without biomedical equivalence inference | [`ayush.md`](ayush.md), [`ayush/safety-boundary.md`](ayush/safety-boundary.md) | Yes, bounded capture | Slide 11 |
| Daily token and status polling | [`waiting-token.md`](waiting-token.md) | Yes; polling, not WebSocket/SSE | Slides 14/16 |
| Signed sessions, role/object checks, private file route, local limits and audit | [`security.md`](security.md), [`architecture.md`](architecture.md) | Qualified: prototype, not production identity/certification | Slide 15, Q&A |
| Demo reset verifies 12 patients, 13 visits, 3 documents, six tokens and Aarav A-001 | [`phase21-demo-reset.md`](phase21-demo-reset.md), [`SIH_DEMO_SCRIPT.md`](SIH_DEMO_SCRIPT.md) | Yes, isolated synthetic baseline only | Live script, demo notes |
| Root tests passed 265 API + 33 web, eight DB tests skipped in Phase 22 | [`phase22-documentation-report.md`](phase22-documentation-report.md), [`testing.md`](testing.md) | Yes, historical Phase 22 audit, not current rerun | Q&A only if asked |
| Full all-browser voice/document/change/safety journey | [`testing.md`](testing.md), [`limitations.md`](limitations.md) | **No**; must not claim | Live-demo caveat |
| Clinical SafetyEngine | [`safety.md`](safety.md), [`limitations.md`](limitations.md) | **No**; schema/display support is not signal-generation logic | Slides 6/9/17, all scripts |
| “Potential impact” on preparation, accessibility and organization | Product hypothesis; no outcome study | **Not measured**; explicitly potential | Slide 17, closing |
| Distributed workers, object storage, production IdP, broader languages, interoperability | [`roadmap.md`](roadmap.md), [`limitations.md`](limitations.md) | **Future only** | Slide 17, Q&A |
| Hospital customers, clinical accuracy, time savings, cost savings, certification | No supporting source | **No claim permitted** | Nowhere |

## Presenter audit gate

Before every event: verify connected demo health, run strict demo reset/verify only on the synthetic database, rehearse microphone/OCR if intending to show them, and update the script if actual behavior differs. Treat any feature not observed live as preseeded or planned, as appropriate. Do not turn a missing clinical SafetyEngine into a claim of safety.

