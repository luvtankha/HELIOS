import { describe, expect, it } from "vitest";
import { saveComplaintSchema } from "../src/validation/patient-flow.js";
import { createInterviewSchema } from "../src/validation/interview.js";

describe("voice and typed complaint length compatibility", () => {
  it.each(["fever", "बुखार", "x".repeat(4000)])(
    "accepts supported transcript length: %.20s",
    (chiefComplaint) => {
      expect(saveComplaintSchema.safeParse({ chiefComplaint }).success).toBe(
        true,
      );
      expect(
        createInterviewSchema.safeParse({
          sessionId: "cm123456789012345678901234",
          chiefComplaint,
          language: "en",
        }).success,
      ).toBe(true);
    },
  );
  it("still rejects empty and oversized input", () => {
    expect(saveComplaintSchema.safeParse({ chiefComplaint: " " }).success).toBe(
      false,
    );
    expect(
      saveComplaintSchema.safeParse({ chiefComplaint: "x".repeat(4001) })
        .success,
    ).toBe(false);
  });
});
