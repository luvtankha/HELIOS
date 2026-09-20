# HELIOS — SIH judge questions

Answers describe the **current prototype**. The bottom section offers 10-second replies for rapid questioning. Evidence for claims is indexed in [SIH_CLAIM_VERIFICATION.md](SIH_CLAIM_VERIFICATION.md).

| Judge question | Concise factual answer |
| - | - |
| What problem are you solving? | Patients often repeat a fragmented history while clinicians assemble context during consultation. HELIOS uses the waiting period for consented, source-aware pre-consultation intake. This is a qualitative problem framing, not a measured prevalence claim. |
| Why is AI necessary? | Optional speech/NLU/OCR adapters can help turn natural input into candidates; they are not required for core rules-based demo flow. The differentiator is the governed workflow, not claiming a novel trained model. |
| Why not a chatbot or an intake form? | A standalone chat/form does not, by itself, connect source evidence, prior/current comparison, a brief, a real queue and explicit doctor verification. We do not claim every competitor lacks these features. |
| How is this different from an EHR? | HELIOS prepares source-linked context before consultation; it is not a deployed EHR replacement or standards-integrated hospital record today. |
| How is patient data protected? | Signed session proofs, role and patient-object checks, schema validation, private document routes, audit records and local rate limiting exist. Production IdP/MFA, retention, tenancy, infrastructure controls and certification do not. |
| Can AI diagnose or prescribe? | No. No diagnosis, prescription, treatment recommendation, emergency screening or independent clinical decision is implemented. |
| Who decides? | The doctor reviews original sources, verifies/corrects/rejects/marks uncertain and makes the clinical decision independently. |
| How does Hindi work? | English/Hindi UI and question resources plus bounded normalization preserve original wording. Hinglish cases are limited. Broad speech/translation accuracy is not clinically evaluated. |
| How does document extraction work? | Validated PDF/image input is stored privately, processed via mock or local OCR, then conservative heuristics propose page-evidenced candidates. Patient and doctor review are separate states. |
| How do you handle hallucination or wrong AI/OCR output? | Schema constraints, original/normalized separation, provenance, uncertainty and doctor review reduce the risk. They do not eliminate content contamination or prove clinical accuracy. |
| Can AI change safety or authorization? | Provider output cannot grant roles, issue tokens, doctor-verify facts or change access control. Crucially, the requested clinical SafetyEngine itself is not implemented. |
| How do the two apps communicate? | Patient and doctor are separate route trees in one Next.js deployment. Both call an Express API; Prisma/PostgreSQL is shared. They do not exchange doctor-only data through the patient UI. |
| How does the token system work? | Check-in transactionally creates a daily queue token. Doctor transitions persist; screens poll the backend, approximately every eight seconds. Priority review is operational, not clinical triage. |
| What if AI fails? | Rules/typed input and visible errors are supported; optional provider failure is disclosed. If backend/data integrity fails, the demo stops rather than faking a result. |
| Can this scale? | Current service separation and persistence offer an architectural basis; distributed workers, object storage, cache, production identity and performance validation are future work. No capacity claim is established. |
| What is implemented today? | Consent-first intake, English/Hindi text UI, bounded voice adapter, deterministic interview, document candidates, timeline, What Changed, Clinical Brief, doctor verification, AYUSH capture, queue and synthetic guarded demo. Defaults are mock/rules/local. |
| What is next? | Clinician-approved SafetyEngine, full browser journey and provider evaluation, production identity/retention, security operations, and deployment validation. |
| How would a hospital deploy it? | A future design could use patient phone/tablet/kiosk in an OPD waiting workflow with an authorized doctor workspace. No hospital customer, production deployment, regulatory clearance or interoperability integration is claimed. |

## Hard questions

| Question | Answer |
| - | - |
| What if the AI is wrong? | It produces reviewable candidates, not decisions. The source stays accessible and the doctor can reject or correct. Clinical validation remains outstanding. |
| What if the patient gives incorrect information? | Patient-reported information retains its source; it is not promoted to doctor-verified truth without an explicit authorized action. |
| What if OCR is wrong? | The original page and extracted candidate stay linked. The candidate can be reviewed, corrected or rejected; handwriting/scanned-PDF limitations are disclosed. |
| What if two records conflict? | Preserve differences and provenance; do not silently reconcile them into a false certainty. The doctor investigates and verifies. |
| What if the doctor disagrees? | Doctor verification can correct/reject/mark uncertain with audit history. The system does not override the clinician. |
| What happens without internet? | A local demo with rules/mocks can function if local web/API/PostgreSQL services remain available. There is no fully offline patient-and-doctor product; remote AI needs connectivity. |
| Why should a hospital trust this? | They should not rely on it clinically yet. The prototype exposes evidence and boundaries; clinician evaluation, security/operational hardening and deployment governance are prerequisites. |
| What prevents an “AI doctor”? | The feature boundary: no diagnosis/prescription/treatment endpoint, provider privilege limits, and explicit doctor verification. This is a design constraint, not clinical certification. |
| What prevents one patient seeing another record? | The API enforces signed patient ownership and object-level authorization; security tests exercise this. Production tenancy and external penetration assurance remain unproven. |
| Why choose it over an intake form? | Evaluate the workflow combination—natural input, evidence, longitudinal comparison, brief, queue and verification—against the organization's needs. We have not measured superiority or purchased adoption. |

## 10-second answers

| Question | Short answer |
| - | - |
| What is HELIOS? | “It turns patient waiting time into structured, source-aware clinical context for the doctor.” |
| What is different? | “It links intake, evidence, change over time, queue and doctor verification in one workflow.” |
| Is it an AI doctor? | “No. It neither diagnoses nor prescribes; the doctor decides.” |
| Is SafetyEngine live? | “No. Clinical safety rules are a clearly labelled next step.” |
| Is Hindi supported? | “Hindi and English UI are active; broader speech/translation quality needs evaluation.” |
| Are documents trusted automatically? | “No. Extraction is a candidate linked to original evidence for review.” |
| Is this deployed? | “It is a local synthetic prototype, not a clinically validated hospital deployment.” |
| Can it work if AI fails? | “Core rules and typed input can continue; we disclose any failed provider.” |
| What is the biggest next milestone? | “Clinician-designed SafetyEngine plus full clinical, security and browser validation.” |

