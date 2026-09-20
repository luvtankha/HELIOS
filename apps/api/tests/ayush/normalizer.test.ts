import { describe, expect, it } from "vitest";
import { AyushNormalizer } from "../../src/ayush/ayush-normalizer.js";

describe("AyushNormalizer", () => {
  const normalizer = new AyushNormalizer();

  it.each([
    ["Ayurveda", "AYURVEDA"],
    ["Yoga/Naturopathy", "YOGA_NATUROPATHY"],
    ["Unani", "UNANI"],
    ["Siddha", "SIDDHA"],
    ["Homoeopathy", "HOMOEOPATHY"],
    ["आयुर्वेद", "AYURVEDA"],
    ["ஆயுர்வேதம்", "AYURVEDA"],
  ])("maps the controlled system %s", (input, expected) => {
    expect(normalizer.system(input)).toBe(expected);
  });

  it("does not fuzzy-identify an unknown system", () => {
    expect(normalizer.system("traditional powder practice")).toBe("UNKNOWN");
  });

  it("preserves original medicine wording without inferring ingredients", () => {
    expect(
      normalizer.normalize({
        system: "Ayurveda",
        originalName: "  some Ayurvedic powder  ",
      }),
    ).toEqual({
      system: "AYURVEDA",
      useStatus: "UNKNOWN",
      originalName: "some Ayurvedic powder",
      normalizedName: "some Ayurvedic powder",
    });
  });

  it("keeps a missing medicine explicit", () => {
    expect(normalizer.normalize({ system: "Ayurveda" })).toMatchObject({
      originalName: "NOT_SPECIFIED",
      system: "AYURVEDA",
    });
  });

  it("normalizes only conservative dose, frequency, and route aliases", () => {
    expect(
      normalizer.normalize({
        originalName: "Documented formulation",
        dosage: "500 milligrams",
        frequency: "two times daily",
        route: "by mouth",
      }),
    ).toMatchObject({
      dosage: "500 mg",
      frequency: "twice daily",
      route: "oral",
    });
  });
});
