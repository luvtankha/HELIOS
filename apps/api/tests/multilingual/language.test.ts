import { describe, expect, it, vi } from "vitest";
import { localeMessages } from "@helios/shared";
import { MultilingualClinicalNormalizer } from "../../src/language/clinical-normalizer.js";
import { DeterministicLanguageDetectionProvider } from "../../src/language/language-detection.js";
import { LanguageRegistry } from "../../src/language/language-registry.js";
import { LanguageService } from "../../src/language/language-service.js";
import { ApprovedResourceTranslationProvider } from "../../src/language/translation.js";
import { InterviewEngine } from "../../src/interview/interview-engine.js";
import { RuleBasedMedicalEntityExtractor } from "../../src/document-ai/providers.js";
import { DoctorProofService } from "../../src/security/doctor-proof.js";
import { SessionProofService } from "../../src/security/session-proof.js";

const normalizer = new MultilingualClinicalNormalizer();

describe("multilingual language layer", () => {
  it("marks only English and Hindi as fully supported", () => {
    const profiles = new LanguageRegistry().list();
    expect(
      profiles
        .filter((item) => item.status === "SUPPORTED")
        .map((item) => item.code),
    ).toEqual(["en", "hi"]);
    expect(profiles.find((item) => item.code === "ur")).toMatchObject({
      status: "COMING_SOON",
      direction: "RTL",
    });
  });

  it.each([
    ["I have stomach pain for three days", "en"],
    ["मुझे तीन दिन से पेट में दर्द है", "hi"],
    ["Pet mein three days se pain hai", "hi"],
  ] as const)(
    "normalizes equivalent abdominal complaints: %s",
    (text, language) => {
      const result = normalizer.normalize(text, language);
      expect(result.concepts.map((item) => item.conceptId)).toContain(
        "SYMPTOM_ABDOMINAL_PAIN",
      );
      expect(result.duration).toEqual({ value: 3, unit: "days" });
      expect(result.originalText).toBe(text);
    },
  );

  it.each([
    ["No fever", "en"],
    ["बुखार नहीं है", "hi"],
    ["Fever nahi hai", "hi"],
  ] as const)("preserves fever negation: %s", (text, language) => {
    expect(normalizer.normalize(text, language).concepts).toContainEqual(
      expect.objectContaining({ conceptId: "SYMPTOM_FEVER", state: "NO" }),
    );
  });

  it("preserves severity and does not over-normalize ambiguity", () => {
    expect(normalizer.normalize("pain level seven", "en").severity).toBe(7);
    const ambiguous = normalizer.normalize("Pet kharab hai", "hi");
    expect(ambiguous.needsClarification).toBe(true);
    expect(ambiguous.concepts).toEqual([]);
  });

  it("reports Hindi and English for code-switched text", () => {
    const result = new DeterministicLanguageDetectionProvider().detectFromText(
      "Pet mein three days se pain hai",
      "hi",
    );
    expect(result.primaryLanguage).toBe("hi");
    expect(result.detectedLanguages).toEqual(["hi", "en"]);
    expect(result.uncertain).toBe(false);
  });

  it("uses selected language when detection is uncertain", () => {
    expect(
      new DeterministicLanguageDetectionProvider().detectFromText("hmm", "hi"),
    ).toMatchObject({ primaryLanguage: "hi", uncertain: true });
  });

  it("uses approved translations and safe original-text fallback", async () => {
    const provider = new ApprovedResourceTranslationProvider();
    await expect(
      provider.translate({
        text: localeMessages.en["safety.attention"],
        sourceLanguage: "en",
        targetLanguage: "hi",
        contextType: "SAFETY_MESSAGE",
      }),
    ).resolves.toMatchObject({
      translatedText: localeMessages.hi["safety.attention"],
      fallbackUsed: false,
    });
    await expect(
      provider.translate({
        text: "Metformin 500 mg",
        sourceLanguage: "en",
        targetLanguage: "hi",
        contextType: "DOCTOR_DISPLAY",
      }),
    ).resolves.toMatchObject({
      translatedText: "Metformin 500 mg",
      fallbackUsed: true,
    });
  });

  it("changes question presentation without changing state or option values", () => {
    const engine = new InterviewEngine();
    const state = engine.initialize("stomach pain");
    const english = engine.getCurrentQuestion(state, "en");
    const hindi = engine.getCurrentQuestion(state, "hi");
    expect(english?.id).toBe(hindi?.id);
    expect(hindi?.text).toBe("दर्द कहाँ हो रहा है?");
    expect(hindi?.optionValues).toEqual(english?.options);
    expect(state.facts.chiefComplaint?.rawAnswers).toEqual(["stomach pain"]);
  });

  it("extracts a Hindi medication frequency while preserving source", () => {
    const facts = new RuleBasedMedicalEntityExtractor().extract(
      [{ pageNumber: 1, text: "दिन में दो बार", blocks: [], confidence: 0.95 }],
      "UNKNOWN",
    );
    expect(facts).toContainEqual(
      expect.objectContaining({
        factType: "medication_instruction",
        sourceText: "दिन में दो बार",
        normalizedValue: { frequency: "twice daily" },
      }),
    );
  });

  it("requires authentication for translation and logs no patient text", async () => {
    const log = { info: vi.fn() };
    const service = serviceWith(log);
    await expect(
      service.translate({
        text: "private patient text",
        sourceLanguage: "en",
        targetLanguage: "hi",
        contextType: "DOCTOR_DISPLAY",
      }),
    ).rejects.toMatchObject({ code: "LANGUAGE_AUTH_REQUIRED" });
    const proof = new SessionProofService("multilingual-test-secret-long");
    await service.translate(
      {
        text: "private patient text",
        sourceLanguage: "en",
        targetLanguage: "hi",
        contextType: "DOCTOR_DISPLAY",
      },
      proof.create("session-1"),
    );
    expect(JSON.stringify(log.info.mock.calls)).not.toContain(
      "private patient text",
    );
  });
});

function serviceWith(log: { info: ReturnType<typeof vi.fn> }) {
  const secret = "multilingual-test-secret-long";
  return new LanguageService(
    new LanguageRegistry(),
    new DeterministicLanguageDetectionProvider(),
    new ApprovedResourceTranslationProvider(),
    normalizer,
    { setDoctorLanguage: vi.fn(async () => ({ count: 1 })) } as never,
    new SessionProofService(secret),
    new DoctorProofService(secret),
    log as never,
  );
}
