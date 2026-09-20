# HELIOS Dataset Quality Report

Generated deterministic synthetic fixtures only. The dataset is not clinically validated and is not representative of India's population.

## Counts

| Metric | Count |
|---|---:|
| patients | 1000 |
| visits | 3000 |
| clinicalFacts | 15000 |
| clinicalSummaries | 3000 |
| conversations | 3000 |
| utterances | 18000 |
| documents | 1000 |
| timelineEvents | 7000 |
| evaluationCases | 3000 |
| doctorVerifications | 1000 |
| speechEvaluationRows | 9000 |
| timelineComparisons | 1000 |

## Patient splits

| Metric | Count |
|---|---:|
| test | 91 |
| train | 790 |
| validation | 119 |

## Utterance language counts

| Metric | Count |
|---|---:|
| en | 5544 |
| hi | 5544 |
| hi-Latn | 6912 |

## Conversation difficulty counts

| Metric | Count |
|---|---:|
| ambiguous | 230 |
| colloquial | 231 |
| contradictory | 231 |
| correction | 230 |
| incomplete | 231 |
| irrelevant-response | 232 |
| misunderstood-question | 229 |
| mixed-language | 231 |
| multiple-symptoms | 232 |
| standard | 229 |
| transcription-error | 231 |
| uncertain-duration | 232 |
| uncertain-severity | 231 |

## Benchmark task counts

| Metric | Count |
|---|---:|
| answer_to_structured_field | 273 |
| contradiction_detection | 273 |
| conversation_to_clinical_history | 273 |
| doctor_verification | 272 |
| document_to_structured_entities | 273 |
| missing_field_detection | 273 |
| multilingual_understanding | 272 |
| question_selection | 273 |
| speech_text_to_clinical_facts | 273 |
| timeline_comparison | 272 |
| timeline_construction | 273 |

## Validation results

| Check | Count |
|---|---:|
| Validation errors | 0 |
| Duplicate IDs | 0 |
| Orphan references | 0 |
| Schema failures | 0 |
| Invalid dates | 0 |
| Patient split leakage | 0 |
| Conversation ordering failures | 0 |
| Timeline ordering failures | 0 |

Validation status: **PASS**

The validator checks required fields, relationships, IDs, dates, enum values, language labels, conversation order, timeline order, document references, target counts, and patient-level split isolation.
