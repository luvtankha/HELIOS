import { describe, expect, it } from "vitest";
import { InterviewEngine } from "../src/interview/interview-engine.js";

const engine = new InterviewEngine();

describe("InterviewEngine", () => {
  it.each([
    [
      "मेरे पेट में तीन दिन से दर्द है और उल्टी जैसा लग रहा है",
      "abdominal_pain",
    ],
    ["I have pressure in my chest", "chest_discomfort"],
    ["My headache started today", "headache"],
    ["I have had a fever for two days", "fever"],
    ["I am coughing and feel short of breath", "cough_breathing"],
    ["My back hurts", "general_pain"],
  ])(
    "selects a supported deterministic pathway for %s",
    (complaint, pathway) => {
      expect(engine.initialize(complaint).pathway).toBe(pathway);
    },
  );

  it("preserves the accepted patient complaint while classifying its pathway", () => {
    const complaint = "I have had a fever and a headache for three days.";
    const state = engine.initialize(complaint);
    expect(state.pathway).toBe("headache");
    expect(state.facts.chiefComplaint).toMatchObject({
      value: complaint,
      source: "PATIENT_REPORTED",
    });
  });

  it("extracts only explicit facts from the bilingual demo complaint", () => {
    const state = engine.initialize(
      "मेरे पेट में teen din se dard hai aur ulti jaisa lag raha hai",
    );
    expect(state.facts.duration?.value).toEqual({ value: 3, unit: "days" });
    expect(state.facts.associatedSymptoms?.value).toEqual([
      "vomiting sensation",
    ]);
    expect(engine.getCurrentQuestion(state)?.id).toBe(
      "abdominal_pain.location",
    );
  });

  it("keeps not-sure distinct from an explicit no", () => {
    const state = engine.initialize("I have chest pain");
    const unknown = engine.processAnswer(
      state,
      "chest_discomfort.location",
      "Not sure",
    );
    expect(unknown.state).toBe("UNKNOWN");
    const no = engine.processAnswer(
      state,
      "chest_discomfort.associatedSymptoms",
      "None of these",
    );
    expect(no.state).toBe("NO");
  });

  it("flags vague answers and asks for clarification", () => {
    const state = engine.initialize("I have a headache");
    const answer = engine.processAnswer(
      state,
      "headache.location",
      "Sometimes",
    );
    const updated = engine.updateState(state, answer, "Sometimes");
    expect(updated.conflicts).toContain("location");
    expect(engine.getCurrentQuestion(updated)?.id).toBe("clarify.location");
  });

  it.each([
    ["seven", 7],
    ["seven out of ten", 7],
    ["10", 10],
    ["saat", 7],
    ["दर्द सात है", 7],
    ["सात में से दस नहीं", 7],
  ])("accepts spoken pain severity %s", (rawAnswer, expected) => {
    const state = engine.initialize("I have a headache");
    expect(
      engine.processAnswer(state, "headache.severity", rawAnswer),
    ).toMatchObject({ value: expected, state: "YES", confidence: "HIGH" });
  });

  it("does not overwrite a conflicting confirmed fact", () => {
    const initial = engine.initialize("I have abdominal pain");
    const first = engine.processAnswer(
      initial,
      "abdominal_pain.location",
      "Upper abdomen",
    );
    const confirmed = engine.updateState(initial, first, "Upper abdomen");
    const changed = engine.processAnswer(
      confirmed,
      "abdominal_pain.location",
      "Lower abdomen",
    );
    expect(changed.state).toBe("CONFLICT");
  });

  it("accepts only the current question's allowed spoken options", () => {
    const state = engine.initialize("I have abdominal pain");
    expect(
      engine.processAnswer(state, "abdominal_pain.location", "option 2"),
    ).toMatchObject({ value: "Lower abdomen", state: "YES" });
    const invalid = engine.processAnswer(
      state,
      "abdominal_pain.location",
      "banana",
    );
    expect(invalid).toMatchObject({ state: "UNKNOWN", ambiguous: true });
    const updated = engine.updateState(state, invalid, "banana");
    expect(updated.facts.location).toBeUndefined();
    expect(engine.getCurrentQuestion(updated)?.id).toBe(
      "abdominal_pain.location",
    );
  });

  it("does not turn an unclear yes/no answer into a medical fact", () => {
    const state = engine.initialize("I have a headache");
    for (const raw of ["maybe", "actually I do not know", "option 2"]) {
      expect(
        engine.processAnswer(state, "common.diabetesProblem", raw),
      ).toMatchObject({ state: "UNKNOWN", ambiguous: true });
    }
  });

  it("applies or retains a conflict candidate without replacing it with yes/no", () => {
    const initial = engine.initialize("I have abdominal pain for three days");
    const conflict = engine.processAnswer(
      initial,
      "abdominal_pain.duration",
      "two days",
    );
    const pending = engine.updateState(initial, conflict, "two days");
    expect(pending.facts.duration?.value).toEqual({ value: 3, unit: "days" });
    expect(pending.conflictCandidates?.duration?.value).toEqual({
      value: 2,
      unit: "days",
    });

    const apply = engine.updateState(
      pending,
      engine.processAnswer(pending, "clarify.duration", "Yes"),
      "Yes",
    );
    expect(apply.facts.duration?.value).toEqual({ value: 2, unit: "days" });
    expect(apply.conflictCandidates?.duration).toBeUndefined();

    const keep = engine.updateState(
      pending,
      engine.processAnswer(pending, "clarify.duration", "No"),
      "No",
    );
    expect(keep.facts.duration?.value).toEqual({ value: 3, unit: "days" });
    expect(keep.conflictCandidates?.duration).toBeUndefined();
  });

  it("finishes after all active required questions are captured", () => {
    let state = engine.initialize("I have chest pain");
    for (const [id, raw] of [
      ["chest_discomfort.location", "Centre of chest"],
      ["chest_discomfort.duration", "2 days"],
      ["chest_discomfort.severity", "6"],
      ["chest_discomfort.associatedSymptoms", "None of these"],
      ["common.bloodPressureProblem", "No"],
      ["common.diabetesProblem", "No"],
      ["common.ayushUse", "No"],
    ] as const) {
      state = engine.updateState(
        state,
        engine.processAnswer(state, id, raw),
        raw,
      );
    }
    expect(engine.calculateMissingInformation(state)).toEqual([]);
    expect(engine.isComplete(state)).toBe(true);
    expect(engine.getCurrentQuestion(state)).toBeUndefined();
  });
});
