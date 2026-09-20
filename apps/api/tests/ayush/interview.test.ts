import { describe, expect, it } from "vitest";
import { InterviewEngine } from "../../src/interview/interview-engine.js";

describe("AYUSH adaptive interview", () => {
  const engine = new InterviewEngine();

  it("asks one screening question after the core history", () => {
    const state = completedCore(engine);
    expect(engine.getCurrentQuestion(state)?.id).toBe("common.ayushUse");
  });

  it("does not open follow-up questions after an explicit no", () => {
    let state = completedCore(engine);
    state = answer(engine, state, "common.ayushUse", "No");
    expect(engine.isComplete(state)).toBe(true);
  });

  it("opens only the AYUSH follow-up branch after yes", () => {
    let state = completedCore(engine);
    state = answer(engine, state, "common.ayushUse", "Yes");
    expect(engine.getCurrentQuestion(state)?.id).toBe("common.ayushSystem");
  });

  it("does not invent a product from an unspecified Ayurvedic medicine", () => {
    let state = completedCore(engine);
    state = answer(engine, state, "common.ayushUse", "Yes");
    state = answer(engine, state, "common.ayushSystem", "Ayurveda");
    state = answer(
      engine,
      state,
      "common.ayushTreatment",
      "some Ayurvedic medicine",
    );
    expect(state.facts.ayushTreatment?.value).toBe("NOT_SPECIFIED");
    expect(JSON.stringify(state)).not.toMatch(/Ashwagandha|Triphala|Turmeric/i);
  });
});

function completedCore(engine: InterviewEngine) {
  let state = engine.initialize("I have chest pain");
  for (const [id, raw] of [
    ["chest_discomfort.location", "Centre of chest"],
    ["chest_discomfort.duration", "2 days"],
    ["chest_discomfort.severity", "6"],
    ["chest_discomfort.associatedSymptoms", "None of these"],
    ["common.bloodPressureProblem", "No"],
    ["common.diabetesProblem", "No"],
  ] as const)
    state = answer(engine, state, id, raw);
  return state;
}

function answer(
  engine: InterviewEngine,
  state: ReturnType<InterviewEngine["initialize"]>,
  id: string,
  raw: string,
) {
  return engine.updateState(state, engine.processAnswer(state, id, raw), raw);
}
