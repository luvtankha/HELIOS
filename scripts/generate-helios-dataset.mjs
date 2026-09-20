import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataset = join(root, "dataset");
const referenceDate = new Date("2026-01-15T09:00:00.000Z");
const patientCount = Number(process.argv[2] ?? 1000);
const seed = Number(process.argv[3] ?? 26047);

const directories = [
  "schemas",
  "generated",
  "train",
  "validation",
  "test",
  "evaluation",
  "documents",
  "conversations",
  "timelines",
];
for (const directory of directories)
  mkdirSync(join(dataset, directory), { recursive: true });

const regions = [
  ["Delhi", "North", "urban"],
  ["Uttar Pradesh", "North", "rural"],
  ["Maharashtra", "West", "urban"],
  ["Gujarat", "West", "rural"],
  ["West Bengal", "East", "urban"],
  ["Odisha", "East", "rural"],
  ["Tamil Nadu", "South", "urban"],
  ["Karnataka", "South", "rural"],
  ["Madhya Pradesh", "Central", "rural"],
  ["Assam", "Northeast", "urban"],
];
const languages = ["en", "hi", "hi-Latn"];
const sexes = ["FEMALE", "MALE", "OTHER", "PREFER_NOT_TO_SAY"];
const cases = [
  caseTemplate(
    "abdominal_pain",
    "abdominal pain",
    "Upper abdomen",
    "vomiting sensation",
  ),
  caseTemplate(
    "chest_discomfort",
    "chest discomfort",
    "Centre of chest",
    "dizziness",
  ),
  caseTemplate("headache", "headache", "Front of head", "light sensitivity"),
  caseTemplate("fever", "fever", "Not applicable", "chills"),
  caseTemplate("cough", "cough", "Chest", "phlegm"),
  caseTemplate(
    "breathing_complaint",
    "breathing difficulty",
    "Chest",
    "wheezing",
  ),
  caseTemplate("back_pain", "back pain", "Lower back", "stiffness"),
  caseTemplate("joint_pain", "joint pain", "Knee", "swelling"),
  caseTemplate("fatigue", "fatigue", "Not applicable", "poor sleep"),
  caseTemplate("vomiting", "vomiting", "Not applicable", "nausea"),
  caseTemplate("diarrhea", "loose stools", "Abdomen", "cramping"),
  caseTemplate("skin_complaint", "skin irritation", "Forearm", "itching"),
  caseTemplate(
    "general_weakness",
    "general weakness",
    "Not applicable",
    "reduced appetite",
  ),
];
const difficulties = [
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
];
const benchmarkTasks = [
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
];

const patients = [];
const visits = [];
const facts = [];
const conversations = [];
const utterances = [];
const documents = [];
const timelines = [];
const verifications = [];
const evaluations = [];

for (let index = 0; index < patientCount; index += 1) {
  const patientId = id("pat", index + 1);
  const language = languages[index % languages.length];
  const region = regions[index % regions.length];
  const patient = {
    id: patientId,
    synthetic: true,
    age: 1 + ((index * 17) % 89),
    sex: sexes[index % sexes.length],
    state: region[0],
    region: region[1],
    context: region[2],
    preferredLanguage: language,
    split: splitFor(index),
    seed: seed + index,
  };
  patients.push(patient);
  const visitTotal = 1 + (index % 5);
  for (let visitIndex = 0; visitIndex < visitTotal; visitIndex += 1) {
    const ordinal = visits.length + 1;
    const visitId = id("vis", ordinal);
    const conversationId = id("con", ordinal);
    const template = cases[(index + visitIndex) % cases.length];
    const difficulty =
      difficulties[(index * 5 + visitIndex) % difficulties.length];
    const conversationLanguage =
      difficulty === "mixed-language" ? "hi-Latn" : language;
    const date = daysBefore(
      referenceDate,
      (patientCount - index) * 2 - visitIndex * 90,
    );
    const duration = 1 + ((index + visitIndex) % 14);
    const severity = 1 + ((index * 3 + visitIndex) % 10);
    const visit = {
      id: visitId,
      patientId,
      date,
      type: visitIndex === 0 ? "PRE_CONSULTATION" : "FOLLOW_UP",
      status: "COMPLETED",
      caseType: template.type,
      chiefComplaint: template.complaint,
      source: "PATIENT_REPORTED",
      split: patient.split,
    };
    visits.push(visit);
    const visitFacts = [
      clinicalFact(
        "chiefComplaint",
        template.complaint,
        "YES",
        "AI_STRUCTURED",
        "HIGH",
      ),
      clinicalFact(
        "duration",
        { value: duration, unit: "days" },
        "YES",
        "AI_STRUCTURED",
        "HIGH",
      ),
      clinicalFact(
        "location",
        template.location,
        template.location === "Not applicable" ? "NOT_APPLICABLE" : "YES",
        "PATIENT_REPORTED",
        "HIGH",
      ),
      clinicalFact("severity", severity, "YES", "PATIENT_REPORTED", "HIGH"),
      clinicalFact(
        "associatedSymptoms",
        [template.associated],
        "YES",
        "AI_STRUCTURED",
        "MEDIUM",
      ),
    ].map((fact, factIndex) => ({
      id: id("fac", facts.length + factIndex + 1),
      patientId,
      visitId,
      effectiveAt: date,
      ...fact,
    }));
    facts.push(...visitFacts);

    const turns = makeTurns({
      conversationId,
      patientId,
      visitId,
      language: conversationLanguage,
      template,
      duration,
      severity,
      difficulty,
    });
    conversations.push({
      id: conversationId,
      patientId,
      visitId,
      language: conversationLanguage,
      difficulty,
      split: patient.split,
      turns,
      expectedHistory: Object.fromEntries(
        visitFacts.map((fact) => [fact.field, fact.value]),
      ),
    });
    utterances.push(...turns);
    timelines.push(
      timeline(
        id("tim", timelines.length + 1),
        patientId,
        visitId,
        date,
        "VISIT",
        template.complaint,
      ),
      timeline(
        id("tim", timelines.length + 2),
        patientId,
        visitId,
        date,
        "PATIENT_REPORTED_SYMPTOM",
        template.complaint,
      ),
    );
    evaluations.push({
      id: id("eva", evaluations.length + 1),
      task: benchmarkTasks[evaluations.length % benchmarkTasks.length],
      patientId,
      visitId,
      conversationId,
      language: conversationLanguage,
      difficulty,
      input: turns.map(({ speaker, text }) => ({ speaker, text })),
      expected: {
        facts: visitFacts.map(({ field, value, state }) => ({
          field,
          value,
          state,
        })),
        nextQuestion: "complete",
        unsupportedFacts: [],
      },
      split: patient.split,
    });
  }

  const latestVisit = visits.at(-1);
  const documentId = id("doc", index + 1);
  const documentType = [
    "prescription",
    "lab_report",
    "discharge_summary",
    "consultation_note",
  ][index % 4];
  const extractionDifficulty = [
    "perfect",
    "ambiguous-dosage",
    "abbreviations",
    "multiple-values",
    "missing-date",
    "ocr-confusion",
  ][index % 6];
  const document = syntheticDocument({
    documentId,
    patientId,
    visitId: latestVisit.id,
    documentType,
    documentDate: latestVisit.date,
    extractionDifficulty,
    index,
  });
  documents.push(document);
  timelines.push(
    timeline(
      id("tim", timelines.length + 1),
      patientId,
      latestVisit.id,
      latestVisit.date,
      "DOCUMENT",
      documentType,
    ),
  );
  const verification = verificationExample(index);
  verifications.push({
    id: id("ver", index + 1),
    patientId,
    visitId: latestVisit.id,
    entityType: "DOCUMENT_EXTRACTION",
    entityId: documentId,
    ...verification,
    source: "DOCTOR_VERIFIED",
  });
}

writeJson("generated/manifest.json", {
  name: "HELIOS original synthetic evaluation dataset",
  version: "1.0.0",
  generatedAt: referenceDate.toISOString(),
  referenceDate: referenceDate.toISOString(),
  seed,
  patientCount,
  disclaimer:
    "Entirely synthetic test data. Not clinically validated and not representative of India's population.",
});
writeJson("generated/patients.json", patients);
writeJsonl("generated/visits.jsonl", visits);
writeJsonl("generated/clinical-facts.jsonl", facts);
writeJsonl(
  "generated/clinical-summaries.jsonl",
  conversations.map((conversation) => ({
    id: `summary-${conversation.id}`,
    patientId: conversation.patientId,
    visitId: conversation.visitId,
    conversationId: conversation.id,
    history: conversation.expectedHistory,
    source: "PATIENT_REPORTED",
    unsupportedFacts: [],
    split: conversation.split,
  })),
);
writeJsonl("conversations/conversations.jsonl", conversations);
writeJsonl("conversations/utterances.jsonl", utterances);
writeJsonl("documents/documents.jsonl", documents);
writeJsonl("timelines/events.jsonl", timelines);
writeJsonl("evaluation/benchmark.jsonl", evaluations);
writeJsonl("evaluation/doctor-verification.jsonl", verifications);
writeJsonl(
  "evaluation/speech-evaluation.jsonl",
  utterances
    .filter((turn) => turn.speaker === "PATIENT")
    .map((turn) => ({
      id: `speech-${turn.id}`,
      utteranceId: turn.id,
      patientId: turn.patientId,
      language: turn.language,
      script:
        turn.language === "hi"
          ? "Devanagari"
          : turn.language === "hi-Latn"
            ? "Latin-code-mixed"
            : "Latin",
      codeMixed: turn.language === "hi-Latn",
      speaker: "PATIENT",
      referenceTranscript: turn.text,
      audioAvailable: false,
      targetMetrics: ["WER_OR_CER", "SEMANTIC_FACT_ACCURACY"],
      difficulty: turn.difficulty,
    })),
);
writeJsonl(
  "evaluation/timeline-comparisons.jsonl",
  patients.map((patient) => timelineComparison(patient, visits, facts)),
);
writeCsv("generated/patients.csv", patients);
writeCsv("generated/visits.csv", visits);
writeCsv("generated/utterances.csv", utterances);
writeCsv("generated/documents.csv", documents);
writeJsonl("generated/fhir.ndjson", fhirResources(patients, visits, facts));
for (const split of ["train", "validation", "test"])
  writeJsonl(
    `${split}/cases.jsonl`,
    patients
      .filter((patient) => patient.split === split)
      .map((patient) => ({
        patient,
        visits: visits.filter((visit) => visit.patientId === patient.id),
        conversations: conversations.filter(
          (conversation) => conversation.patientId === patient.id,
        ),
      })),
  );

console.log(
  JSON.stringify({
    patients: patients.length,
    visits: visits.length,
    clinicalFacts: facts.length,
    conversations: conversations.length,
    utterances: utterances.length,
    documents: documents.length,
    timelineEvents: timelines.length,
  }),
);

function caseTemplate(type, complaint, location, associated) {
  return { type, complaint, location, associated };
}
function clinicalFact(field, value, state, source, confidence) {
  return { field, value, state, source, confidence };
}
function makeTurns(input) {
  const {
    conversationId,
    patientId,
    visitId,
    language,
    template,
    duration,
    severity,
    difficulty,
  } = input;
  const texts = utteranceSet(
    language,
    template,
    duration,
    severity,
    difficulty,
  );
  return texts.map((turn, turnIndex) => ({
    id: `${conversationId}-t${turnIndex + 1}`,
    conversationId,
    patientId,
    visitId,
    turnIndex,
    speaker: turnIndex % 2 === 0 ? "SYSTEM" : "PATIENT",
    language,
    text: turn,
    questionId:
      turnIndex % 2 === 0
        ? ["chiefComplaint", "duration", "severity"][turnIndex / 2]
        : null,
    clinicalFacts:
      turnIndex % 2 === 1 ? expectedTurnFacts(difficulty, turnIndex) : [],
    expectedStateChange:
      turnIndex % 2 === 1 ? expectedTurnState(difficulty, turnIndex) : "NONE",
    nextQuestion:
      turnIndex === 5
        ? "complete"
        : ["duration", "severity", "complete"][Math.floor(turnIndex / 2)],
    difficulty,
  }));
}
function utteranceSet(language, template, duration, severity, difficulty) {
  let texts;
  if (language === "hi")
    texts = [
      "आज आपको किस परेशानी के बारे में बताना है?",
      `मुझे ${template.complaint} की परेशानी है।`,
      "यह कब से हो रहा है?",
      `${duration} दिन से।`,
      "0 से 10 में यह कितना तेज़ है?",
      `${severity}।`,
    ];
  else if (language === "hi-Latn")
    texts = [
      "Aaj aapko kya problem ho rahi hai?",
      `Mujhe ${template.complaint} ho raha hai.`,
      "Ye kab se ho raha hai?",
      `${duration} din se.`,
      "Zero se ten mein kitna strong hai?",
      `${severity} hai.`,
    ];
  else
    texts = [
      "What brings you here today?",
      `I have ${template.complaint}.`,
      "How long has this been happening?",
      `For ${duration} ${duration === 1 ? "day" : "days"}.`,
      "How strong is it from 0 to 10?",
      `${severity}.`,
    ];

  const say = (english, hindi, hinglish) =>
    language === "hi" ? hindi : language === "hi-Latn" ? hinglish : english;
  if (difficulty === "ambiguous")
    texts[3] = say("Sometimes.", "कभी-कभी।", "Kabhi kabhi.");
  if (difficulty === "incomplete")
    texts[3] = say("I don't know.", "मुझे पता नहीं।", "Mujhe pata nahi.");
  if (difficulty === "contradictory") {
    texts[1] = say(
      "I do not have vomiting.",
      "मुझे उल्टी नहीं है।",
      "Mujhe vomiting nahi hai.",
    );
    texts[3] = say(
      "Actually I vomited yesterday.",
      "असल में कल उल्टी हुई थी।",
      "Actually kal vomiting hui thi.",
    );
  }
  if (difficulty === "mixed-language")
    texts[1] = "Kal se pet mein pain ho raha hai.";
  if (difficulty === "colloquial")
    texts[1] = say(
      "My stomach is acting up.",
      "पेट गड़बड़ लग रहा है।",
      "Pet gadbad lag raha hai.",
    );
  if (difficulty === "transcription-error")
    texts[3] = say("tree dys", "तीन दन से", "tin dn se");
  if (difficulty === "irrelevant-response")
    texts[3] = say(
      "I came here by bus.",
      "मैं बस से आया हूँ।",
      "Main bus se aaya hoon.",
    );
  if (difficulty === "multiple-symptoms")
    texts[1] = say(
      `I have ${template.complaint} and ${template.associated}.`,
      `मुझे ${template.complaint} और ${template.associated} है।`,
      `Mujhe ${template.complaint} aur ${template.associated} hai.`,
    );
  if (difficulty === "uncertain-duration")
    texts[3] = say("For a few days.", "कुछ दिनों से।", "Kuch din se.");
  if (difficulty === "uncertain-severity")
    texts[5] = say("I'm not sure.", "ठीक से पता नहीं।", "Theek se pata nahi.");
  if (difficulty === "correction")
    texts[5] = say(
      `I first thought 4, actually it is ${severity}.`,
      `पहले 4 लगा, असल में ${severity} है।`,
      `Pehle 4 laga, actually ${severity} hai.`,
    );
  if (difficulty === "misunderstood-question")
    texts[5] = say(
      "Do you mean how long?",
      "क्या आप अवधि पूछ रहे हैं?",
      "Aap duration pooch rahe hain?",
    );
  return texts;
}
function expectedField(turnIndex) {
  return ["chiefComplaint", "duration", "severity"][(turnIndex - 1) / 2];
}
function expectedTurnFacts(difficulty, turnIndex) {
  if (difficulty === "contradictory" && (turnIndex === 1 || turnIndex === 3))
    return ["associatedSymptoms"];
  if (
    (turnIndex === 3 &&
      [
        "ambiguous",
        "incomplete",
        "irrelevant-response",
        "transcription-error",
        "uncertain-duration",
      ].includes(difficulty)) ||
    (turnIndex === 5 &&
      ["uncertain-severity", "misunderstood-question"].includes(difficulty))
  )
    return [];
  return [expectedField(turnIndex)];
}
function expectedTurnState(difficulty, turnIndex) {
  if (difficulty === "contradictory" && turnIndex === 3) return "CONFLICT";
  if (
    (turnIndex === 3 &&
      [
        "ambiguous",
        "incomplete",
        "irrelevant-response",
        "transcription-error",
        "uncertain-duration",
      ].includes(difficulty)) ||
    (turnIndex === 5 &&
      ["uncertain-severity", "misunderstood-question"].includes(difficulty))
  )
    return "NEEDS_CLARIFICATION";
  return "CAPTURE_EXPLICIT_FACT";
}
function syntheticDocument(input) {
  const dose =
    input.extractionDifficulty === "ocr-confusion" ? "5OO mg" : "500 mg";
  const frequency =
    input.extractionDifficulty === "abbreviations" ? "OD" : "once daily";
  const extraText =
    input.extractionDifficulty === "multiple-values"
      ? " Amlodipine 5 mg once daily. Glucose 96 mg/dL."
      : "";
  const extraEntities =
    input.extractionDifficulty === "multiple-values"
      ? [
          {
            type: "medicine",
            value: "Amlodipine",
            source: "DOCUMENT_EXTRACTED",
          },
          { type: "dose", value: "5 mg", source: "DOCUMENT_EXTRACTED" },
          {
            type: "labTest",
            value: "Glucose",
            source: "DOCUMENT_EXTRACTED",
          },
          { type: "result", value: 96, source: "DOCUMENT_EXTRACTED" },
          { type: "unit", value: "mg/dL", source: "DOCUMENT_EXTRACTED" },
        ]
      : [];
  return {
    id: input.documentId,
    patientId: input.patientId,
    visitId: input.visitId,
    documentType: input.documentType,
    documentDate:
      input.extractionDifficulty === "missing-date" ? null : input.documentDate,
    synthetic: true,
    syntheticText: `SYNTHETIC ${input.documentType}. Documented diagnosis: hypertension. Metformin ${dose} ${frequency}. Haemoglobin ${10 + (input.index % 5)} g/dL; reference range 12–16 g/dL.${extraText} Doctor: Dr Synthetic. Facility: HELIOS Demo Clinic.`,
    expectedEntities: [
      {
        type: "diagnosis",
        value: "hypertension",
        source: "DOCUMENT_EXTRACTED",
      },
      { type: "medicine", value: "Metformin", source: "DOCUMENT_EXTRACTED" },
      { type: "dose", value: "500 mg", source: "DOCUMENT_EXTRACTED" },
      {
        type: "frequency",
        value: "once daily",
        source: "DOCUMENT_EXTRACTED",
      },
      { type: "labTest", value: "Haemoglobin", source: "DOCUMENT_EXTRACTED" },
      { type: "unit", value: "g/dL", source: "DOCUMENT_EXTRACTED" },
      {
        type: "result",
        value: 10 + (input.index % 5),
        source: "DOCUMENT_EXTRACTED",
      },
      {
        type: "referenceRange",
        value: "12–16 g/dL",
        source: "DOCUMENT_EXTRACTED",
      },
      {
        type: "doctor",
        value: "Dr Synthetic",
        source: "DOCUMENT_EXTRACTED",
      },
      {
        type: "facility",
        value: "HELIOS Demo Clinic",
        source: "DOCUMENT_EXTRACTED",
      },
      ...extraEntities,
    ],
    difficulty: input.extractionDifficulty,
  };
}
function timeline(idValue, patientId, visitId, eventDate, eventType, title) {
  return {
    id: idValue,
    patientId,
    visitId,
    eventDate,
    eventType,
    title,
    source: "SYSTEM_GENERATED",
  };
}
function timelineComparison(patient, allVisits, allFacts) {
  const ownVisits = allVisits.filter((visit) => visit.patientId === patient.id);
  const first = ownVisits[0];
  const last = ownVisits.at(-1);
  const firstSeverity = allFacts.find(
    (fact) => fact.visitId === first.id && fact.field === "severity",
  )?.value;
  const lastSeverity = allFacts.find(
    (fact) => fact.visitId === last.id && fact.field === "severity",
  )?.value;
  const firstAssociated = allFacts.find(
    (fact) => fact.visitId === first.id && fact.field === "associatedSymptoms",
  )?.value?.[0];
  const lastAssociated = allFacts.find(
    (fact) => fact.visitId === last.id && fact.field === "associatedSymptoms",
  )?.value?.[0];
  const changes = [
    {
      field: "severity",
      before: firstSeverity,
      after: lastSeverity,
      status: firstSeverity === lastSeverity ? "UNCHANGED" : "CHANGED",
    },
    {
      field: "chiefComplaint",
      before: first.chiefComplaint,
      after: last.chiefComplaint,
      status:
        first.chiefComplaint === last.chiefComplaint ? "UNCHANGED" : "CHANGED",
    },
  ];
  if (firstAssociated === lastAssociated)
    changes.push({
      field: "associatedSymptoms",
      before: firstAssociated,
      after: lastAssociated,
      status: "UNCHANGED",
    });
  else {
    changes.push({
      field: "associatedSymptoms",
      before: firstAssociated,
      after: null,
      status: "REMOVED",
    });
    changes.push({
      field: "associatedSymptoms",
      before: null,
      after: lastAssociated,
      status: "NEW",
    });
  }
  return {
    id: `cmp-${patient.id}`,
    patientId: patient.id,
    fromVisitId: first.id,
    toVisitId: last.id,
    expected: {
      severity: firstSeverity === lastSeverity ? "UNCHANGED" : "CHANGED",
      chiefComplaint:
        first.chiefComplaint === last.chiefComplaint ? "UNCHANGED" : "CHANGED",
      changes,
      unsupportedInterpretations: [],
    },
  };
}
function verificationExample(index) {
  return [
    {
      aiValue: "Metformin 500 mg",
      doctorValue: "Metformin 500 mg",
      status: "VERIFIED",
    },
    {
      aiValue: "Metformin 500 mg",
      doctorValue: "Metformin 500 mg once daily",
      status: "PARTIALLY_CORRECT",
    },
    {
      aiValue: "Metformin 50 mg",
      doctorValue: "Metformin 500 mg",
      status: "EDITED",
    },
    {
      aiValue: "Aspirin 75 mg",
      doctorValue: null,
      status: "REJECTED",
    },
    {
      aiValue: null,
      doctorValue: "Haemoglobin 14 g/dL",
      status: "MISSED",
    },
  ][index % 5];
}
function fhirResources(allPatients, allVisits, allFacts) {
  return [
    ...allPatients.map((patient) => ({
      resourceType: "Patient",
      id: patient.id,
      identifier: [
        {
          system: "https://helios.example/synthetic-patient",
          value: patient.id,
        },
      ],
      gender:
        patient.sex === "FEMALE"
          ? "female"
          : patient.sex === "MALE"
            ? "male"
            : "unknown",
      extension: [
        { url: "https://helios.example/synthetic", valueBoolean: true },
      ],
    })),
    ...allVisits.map((visit) => ({
      resourceType: "Encounter",
      id: visit.id,
      status: "finished",
      class: {
        system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
        code: "AMB",
      },
      subject: { reference: `Patient/${visit.patientId}` },
      period: { start: visit.date, end: visit.date },
    })),
    ...allFacts.map((fact) => ({
      resourceType: "Observation",
      id: fact.id,
      status: "final",
      code: { text: fact.field },
      subject: { reference: `Patient/${fact.patientId}` },
      encounter: { reference: `Encounter/${fact.visitId}` },
      effectiveDateTime: fact.effectiveAt,
      valueString:
        typeof fact.value === "string"
          ? fact.value
          : JSON.stringify(fact.value),
      meta: {
        tag: [
          { system: "https://helios.example/provenance", code: fact.source },
        ],
      },
    })),
  ];
}
function splitFor(index) {
  const bucket =
    Number.parseInt(
      createHash("sha256")
        .update(`helios-${seed}-${index}`)
        .digest("hex")
        .slice(0, 8),
      16,
    ) % 10;
  return bucket < 8 ? "train" : bucket === 8 ? "validation" : "test";
}
function daysBefore(date, days) {
  return new Date(date.getTime() - days * 86_400_000).toISOString();
}
function id(prefix, value) {
  return `${prefix}-${String(value).padStart(6, "0")}`;
}
function writeJson(path, value) {
  writeFileSync(join(dataset, path), `${JSON.stringify(value, null, 2)}\n`);
}
function writeJsonl(path, values) {
  writeFileSync(
    join(dataset, path),
    `${values.map((value) => JSON.stringify(value)).join("\n")}\n`,
  );
}
function writeCsv(path, values) {
  if (!values.length) return;
  const keys = Object.keys(values[0]);
  const rows = [
    keys.join(","),
    ...values.map((value) => keys.map((key) => csv(value[key])).join(",")),
  ];
  writeFileSync(join(dataset, path), `${rows.join("\n")}\n`);
}
function csv(value) {
  const text =
    typeof value === "object" && value !== null
      ? JSON.stringify(value)
      : String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}
