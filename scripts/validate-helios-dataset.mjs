import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataset = join(root, "dataset");
const patients = JSON.parse(read("generated/patients.json"));
const visits = jsonl("generated/visits.jsonl");
const facts = jsonl("generated/clinical-facts.jsonl");
const summaries = jsonl("generated/clinical-summaries.jsonl");
const conversations = jsonl("conversations/conversations.jsonl");
const utterances = jsonl("conversations/utterances.jsonl");
const documents = jsonl("documents/documents.jsonl");
const timelines = jsonl("timelines/events.jsonl");
const evaluations = jsonl("evaluation/benchmark.jsonl");
const verifications = jsonl("evaluation/doctor-verification.jsonl");
const speechEvaluations = jsonl("evaluation/speech-evaluation.jsonl");
const comparisons = jsonl("evaluation/timeline-comparisons.jsonl");

const errors = [];
const duplicateIds = [];
const orphanIds = [];
const schemaFailures = [];
const invalidDates = [];
const allowedSources = new Set([
  "PATIENT_REPORTED",
  "AI_STRUCTURED",
  "DOCUMENT_EXTRACTED",
  "DOCTOR_VERIFIED",
  "SYSTEM_GENERATED",
]);
const allowedStates = new Set([
  "YES",
  "NO",
  "UNKNOWN",
  "NOT_ASKED",
  "NOT_APPLICABLE",
  "CONFLICT",
]);
const allowedLanguages = new Set(["en", "hi", "hi-Latn"]);
const allowedTurnStates = new Set([
  "NONE",
  "CAPTURE_EXPLICIT_FACT",
  "NEEDS_CLARIFICATION",
  "CONFLICT",
]);
const requiredBenchmarkTasks = new Set([
  "speech_text_to_clinical_facts",
  "answer_to_structured_field",
  "conversation_to_clinical_history",
  "missing_field_detection",
  "question_selection",
  "contradiction_detection",
  "document_to_structured_entities",
  "timeline_construction",
  "timeline_comparison",
  "doctor_verification",
  "multilingual_understanding",
]);
const requiredDifficulties = new Set([
  "standard",
  "ambiguous",
  "incomplete",
  "contradictory",
  "mixed-language",
  "colloquial",
  "transcription-error",
  "irrelevant-response",
  "multiple-symptoms",
  "uncertain-duration",
  "uncertain-severity",
  "correction",
  "misunderstood-question",
]);
const patientIds = uniqueIds("patients", patients);
const visitIds = uniqueIds("visits", visits);
uniqueIds("facts", facts);
uniqueIds("summaries", summaries);
uniqueIds("conversations", conversations);
uniqueIds("utterances", utterances);
uniqueIds("documents", documents);
uniqueIds("timelines", timelines);
uniqueIds("evaluations", evaluations);
uniqueIds("verifications", verifications);
uniqueIds("speech-evaluations", speechEvaluations);
uniqueIds("timeline-comparisons", comparisons);

for (const patient of patients) {
  requireFields("patient", patient, [
    "id",
    "synthetic",
    "age",
    "sex",
    "state",
    "preferredLanguage",
    "split",
  ]);
  if (patient.synthetic !== true)
    schemaFailures.push(`${patient.id}:not-synthetic`);
  if (!allowedLanguages.has(patient.preferredLanguage))
    schemaFailures.push(`${patient.id}:language`);
}
for (const record of [
  ...visits,
  ...facts,
  ...summaries,
  ...conversations,
  ...documents,
  ...timelines,
  ...evaluations,
  ...verifications,
  ...speechEvaluations,
]) {
  if (record.patientId && !patientIds.has(record.patientId))
    orphanIds.push(`${record.id}:patient`);
  if (record.visitId && !visitIds.has(record.visitId))
    orphanIds.push(`${record.id}:visit`);
}
for (const fact of facts) {
  requireFields("fact", fact, [
    "id",
    "patientId",
    "visitId",
    "field",
    "state",
    "source",
    "effectiveAt",
  ]);
  if (!allowedSources.has(fact.source))
    schemaFailures.push(`${fact.id}:source`);
  if (!allowedStates.has(fact.state)) schemaFailures.push(`${fact.id}:state`);
  validDate(fact.id, fact.effectiveAt);
}
for (const visit of visits) validDate(visit.id, visit.date);
for (const timeline of timelines) {
  validDate(timeline.id, timeline.eventDate);
  if (!allowedSources.has(timeline.source))
    schemaFailures.push(`${timeline.id}:source`);
}
for (const conversation of conversations) {
  if (!allowedLanguages.has(conversation.language))
    schemaFailures.push(`${conversation.id}:language`);
  conversation.turns.forEach((turn, index) => {
    if (turn.turnIndex !== index)
      schemaFailures.push(`${conversation.id}:turn-order`);
    if (turn.conversationId !== conversation.id)
      orphanIds.push(`${turn.id}:conversation`);
    if (!allowedTurnStates.has(turn.expectedStateChange))
      schemaFailures.push(`${turn.id}:expected-state-change`);
    if (!allowedLanguages.has(turn.language))
      schemaFailures.push(`${turn.id}:language`);
  });
}
for (const document of documents) {
  if (document.synthetic !== true)
    schemaFailures.push(`${document.id}:not-synthetic`);
  if (document.documentDate !== null)
    validDate(document.id, document.documentDate);
}
for (const patient of patients) {
  const dates = timelines
    .filter((event) => event.patientId === patient.id)
    .map((event) => Date.parse(event.eventDate));
  if (dates.some((date, index) => index > 0 && date < dates[index - 1]))
    schemaFailures.push(`${patient.id}:timeline-order`);
  const splitSet = new Set([
    patient.split,
    ...visits
      .filter((visit) => visit.patientId === patient.id)
      .map((visit) => visit.split),
    ...conversations
      .filter((conversation) => conversation.patientId === patient.id)
      .map((conversation) => conversation.split),
  ]);
  if (splitSet.size !== 1) schemaFailures.push(`${patient.id}:split-leakage`);
}

const splitCounts = countBy(patients, "split");
const languageCounts = countBy(utterances, "language");
const difficultyCounts = countBy(conversations, "difficulty");
const benchmarkTaskCounts = countBy(evaluations, "task");
for (const task of requiredBenchmarkTasks)
  if (!benchmarkTaskCounts[task])
    schemaFailures.push(`benchmark:${task}:missing`);
for (const difficulty of requiredDifficulties)
  if (!difficultyCounts[difficulty])
    schemaFailures.push(`difficulty:${difficulty}:missing`);
for (const speech of speechEvaluations) {
  if (!allowedLanguages.has(speech.language))
    schemaFailures.push(`${speech.id}:language`);
  if (speech.audioAvailable !== false)
    schemaFailures.push(`${speech.id}:unexpected-audio`);
}
const timelineChangeStates = new Set(
  comparisons.flatMap((record) =>
    record.expected.changes.map((change) => change.status),
  ),
);
for (const state of ["NEW", "REMOVED", "CHANGED", "UNCHANGED"])
  if (!timelineChangeStates.has(state))
    schemaFailures.push(`timeline-change:${state}:missing`);
const verificationStates = new Set(
  verifications.map((record) => record.status),
);
for (const state of [
  "VERIFIED",
  "PARTIALLY_CORRECT",
  "EDITED",
  "REJECTED",
  "MISSED",
])
  if (!verificationStates.has(state))
    schemaFailures.push(`doctor-verification:${state}:missing`);
const counts = {
  patients: patients.length,
  visits: visits.length,
  clinicalFacts: facts.length,
  clinicalSummaries: summaries.length,
  conversations: conversations.length,
  utterances: utterances.length,
  documents: documents.length,
  timelineEvents: timelines.length,
  evaluationCases: evaluations.length,
  doctorVerifications: verifications.length,
  speechEvaluationRows: speechEvaluations.length,
  timelineComparisons: comparisons.length,
};
if (counts.patients < 1000) errors.push("patient target not met");
if (counts.visits < 3000) errors.push("visit target not met");
if (counts.clinicalFacts < 10000) errors.push("clinical fact target not met");
if (counts.utterances < 5000) errors.push("utterance target not met");
if (counts.documents < 1000) errors.push("document target not met");
if (counts.timelineEvents < 5000) errors.push("timeline target not met");
errors.push(...schemaFailures, ...duplicateIds, ...orphanIds, ...invalidDates);

const report = `# HELIOS Dataset Quality Report

Generated deterministic synthetic fixtures only. The dataset is not clinically validated and is not representative of India's population.

## Counts

${table(counts)}

## Patient splits

${table(splitCounts)}

## Utterance language counts

${table(languageCounts)}

## Conversation difficulty counts

${table(difficultyCounts)}

## Benchmark task counts

${table(benchmarkTaskCounts)}

## Validation results

| Check | Count |
|---|---:|
| Validation errors | ${errors.length} |
| Duplicate IDs | ${duplicateIds.length} |
| Orphan references | ${orphanIds.length} |
| Schema failures | ${schemaFailures.length} |
| Invalid dates | ${invalidDates.length} |
| Patient split leakage | ${schemaFailures.filter((value) => value.endsWith(":split-leakage")).length} |
| Conversation ordering failures | ${schemaFailures.filter((value) => value.endsWith(":turn-order")).length} |
| Timeline ordering failures | ${schemaFailures.filter((value) => value.endsWith(":timeline-order")).length} |

Validation status: **${errors.length === 0 ? "PASS" : "FAIL"}**

The validator checks required fields, relationships, IDs, dates, enum values, language labels, conversation order, timeline order, document references, target counts, and patient-level split isolation.
`;
writeFileSync(join(dataset, "QUALITY_REPORT.md"), report);
console.log(
  JSON.stringify({
    status: errors.length === 0 ? "PASS" : "FAIL",
    counts,
    errors: errors.slice(0, 20),
  }),
);
if (errors.length) process.exitCode = 1;

function read(path) {
  return readFileSync(join(dataset, path), "utf8");
}
function jsonl(path) {
  return read(path)
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}
function uniqueIds(label, values) {
  const ids = new Set();
  for (const value of values) {
    if (!value.id) schemaFailures.push(`${label}:missing-id`);
    else if (ids.has(value.id)) duplicateIds.push(`${label}:${value.id}`);
    ids.add(value.id);
  }
  return ids;
}
function requireFields(label, value, fields) {
  for (const field of fields)
    if (value[field] === undefined)
      schemaFailures.push(`${label}:${value.id}:${field}`);
}
function validDate(id, value) {
  if (!value || Number.isNaN(Date.parse(value))) invalidDates.push(id);
}
function countBy(values, key) {
  return Object.fromEntries(
    [...new Set(values.map((value) => value[key]))]
      .sort()
      .map((value) => [
        value,
        values.filter((item) => item[key] === value).length,
      ]),
  );
}
function table(values) {
  return `| Metric | Count |\n|---|---:|\n${Object.entries(values)
    .map(([key, value]) => `| ${key} | ${value} |`)
    .join("\n")}`;
}
