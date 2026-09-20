import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { InterviewEngine } from "../src/interview/interview-engine.js";

const datasetRoot = fileURLToPath(
  new URL("../../../dataset/", import.meta.url),
);

function json(path: string) {
  return JSON.parse(readFileSync(`${datasetRoot}${path}`, "utf8"));
}

function jsonl(path: string) {
  return readFileSync(`${datasetRoot}${path}`, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

describe("HELIOS synthetic evaluation corpus", () => {
  it("meets target counts and keeps all records synthetic", () => {
    const patients = json("generated/patients.json");
    const visits = jsonl("generated/visits.jsonl");
    const facts = jsonl("generated/clinical-facts.jsonl");
    const utterances = jsonl("conversations/utterances.jsonl");
    const documents = jsonl("documents/documents.jsonl");
    const timeline = jsonl("timelines/events.jsonl");

    expect(patients).toHaveLength(1000);
    expect(visits.length).toBeGreaterThanOrEqual(3000);
    expect(facts.length).toBeGreaterThanOrEqual(10_000);
    expect(utterances.length).toBeGreaterThanOrEqual(5000);
    expect(documents.length).toBeGreaterThanOrEqual(1000);
    expect(timeline.length).toBeGreaterThanOrEqual(5000);
    expect(
      patients.every((patient: { synthetic: boolean }) => patient.synthetic),
    ).toBe(true);
    expect(
      documents.every((document: { synthetic: boolean }) => document.synthetic),
    ).toBe(true);
  });

  it("covers every requested benchmark task and difficult dialogue type", () => {
    const evaluations = jsonl("evaluation/benchmark.jsonl");
    const conversations = jsonl("conversations/conversations.jsonl");
    const tasks = new Set(evaluations.map((record) => record.task));
    const difficulties = new Set(
      conversations.map((record) => record.difficulty),
    );

    expect(tasks).toEqual(
      new Set([
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
      ]),
    );
    expect(difficulties).toEqual(
      new Set([
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
      ]),
    );
  });

  it("keeps each patient in exactly one split", () => {
    const patients = json("generated/patients.json");
    const visits = jsonl("generated/visits.jsonl");
    const expected = new Map(
      patients.map((patient) => [patient.id, patient.split]),
    );
    expect(
      visits.every((visit) => expected.get(visit.patientId) === visit.split),
    ).toBe(true);
  });

  it("marks difficult answers for clarification or conflict", () => {
    const conversations = jsonl("conversations/conversations.jsonl");
    const ambiguous = conversations.find(
      (record) => record.difficulty === "ambiguous",
    );
    const contradictory = conversations.find(
      (record) => record.difficulty === "contradictory",
    );
    expect(
      ambiguous.turns.some(
        (turn) => turn.expectedStateChange === "NEEDS_CLARIFICATION",
      ),
    ).toBe(true);
    expect(
      contradictory.turns.some(
        (turn) => turn.expectedStateChange === "CONFLICT",
      ),
    ).toBe(true);
  });

  it("covers longitudinal deltas and doctor verification outcomes", () => {
    const comparisons = jsonl("evaluation/timeline-comparisons.jsonl");
    const verifications = jsonl("evaluation/doctor-verification.jsonl");
    const changeStates = new Set(
      comparisons.flatMap((record) =>
        record.expected.changes.map((change) => change.status),
      ),
    );
    const verificationStates = new Set(
      verifications.map((record) => record.status),
    );
    expect(changeStates).toEqual(
      new Set(["NEW", "REMOVED", "CHANGED", "UNCHANGED"]),
    );
    expect(verificationStates).toEqual(
      new Set([
        "VERIFIED",
        "PARTIALLY_CORRECT",
        "EDITED",
        "REJECTED",
        "MISSED",
      ]),
    );
  });

  it.each([
    ["I have pressure in my chest", "chest_discomfort"],
    ["मेरे पेट में तीन दिन से दर्द है", "abdominal_pain"],
    ["Mujhe pet mein teen din se dard hai", "abdominal_pain"],
  ])(
    "runs a representative corpus language through the deterministic engine",
    (text, pathway) => {
      expect(new InterviewEngine().initialize(text).pathway).toBe(pathway);
    },
  );
});
