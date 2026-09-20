# HELIOS to FHIR R4 mapping reference

FHIR is an interoperability projection, not HELIOS's storage model. Mapping requires validation against the target implementation guide before production exchange.

| HELIOS             | FHIR candidate                           | Mapping notes                                                                                              |
| ------------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| PatientProfile     | Patient                                  | `patientCode` becomes an Identifier; names/demographics map conservatively                                 |
| Visit              | Encounter                                | status/type/period map; HELIOS ID is retained as Identifier                                                |
| Symptom            | Observation or Condition                 | use Observation for reported symptom facts; Condition only for explicitly documented historical conditions |
| Observation        | Observation                              | concept key/code, value[x], unit, reference range, effective time, status, subject, encounter              |
| Medication         | MedicationStatement or MedicationRequest | patient-reported use maps to MedicationStatement; an actual clinician order maps to MedicationRequest      |
| Allergy            | AllergyIntolerance                       | allergen, reaction, severity, clinical/verification status                                                 |
| MedicalDocument    | DocumentReference                        | MIME type, date, patient, encounter, storage attachment reference                                          |
| DocumentExtraction | Provenance plus derived records          | keep extraction metadata internally; exported derived records carry Provenance                             |
| ClinicalHistory    | Composition                              | sectioned patient-reported history; do not turn unverified text into Conditions                            |
| TimelineEvent      | Relevant resource event                  | timeline is a HELIOS projection, not normally a standalone FHIR resource                                   |
| DoctorVerification | Provenance                               | agent, time, target, and activity; original/verified values remain internal audit detail                   |
| ConsentRecord      | Consent                                  | policy/version/status/date with subject where known                                                        |
| Interview          | QuestionnaireResponse                    | question/answer capture where useful; adaptive engine remains internal                                     |
| InterviewResponse  | QuestionnaireResponse.item               | raw answer may be retained as extension; normalized facts export separately with provenance                |
| VoiceInteraction   | Media/DocumentReference (optional)       | only when audio is retained with consent; Phase 3 normally does not retain audio                           |
| RiskSignal         | DetectedIssue (future)                   | Phase 5 only; no mapping is emitted now                                                                    |

## Provenance

`PATIENT_REPORTED`, `AI_STRUCTURED`, `DOCUMENT_EXTRACTED`, `DOCTOR_VERIFIED`, and `SYSTEM_GENERATED` remain distinct internally. FHIR output should use Provenance agents/activities and extensions or tags where the base resource cannot express this distinction safely.

## Generated subset

The dataset generator emits lightweight Patient, Encounter, and Observation resources in FHIR-compatible NDJSON. They are structural evaluation fixtures, not certified profiles or production exchange bundles.
