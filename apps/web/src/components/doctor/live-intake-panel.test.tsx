import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LiveIntakePanel } from "./live-intake-panel";

describe("live doctor intake", () => {
  it("shows the patient's saved facts, uncertainty and evidence", () => {
    render(
      <LiveIntakePanel
        intake={{
          patientSessionId: "session",
          language: "hi-Hinglish",
          status: "READY_FOR_REVIEW",
          facts: [
            {
              id: "fact",
              field: "chiefComplaint",
              value: "chest pressure",
              knowledgeState: "KNOWN",
              confidence: "HIGH",
              source: "PATIENT_REPORTED",
              evidenceTurnIds: ["turn-1"],
              model: "gemini-live",
              conversationPolicyVersion: "v1",
              updatedAt: "2026-10-04T00:00:00Z",
            },
            {
              id: "unknown",
              field: "onset",
              knowledgeState: "UNKNOWN",
              source: "PATIENT_REPORTED",
              evidenceTurnIds: ["turn-2"],
              model: "gemini-live",
              conversationPolicyVersion: "v1",
              updatedAt: "2026-10-04T00:00:00Z",
            },
          ],
        }}
      />,
    );
    expect(screen.getByText("chest pressure")).toBeInTheDocument();
    expect(screen.getByText("Evidence: turn-1")).toBeInTheDocument();
    expect(screen.getByText("Not known")).toBeInTheDocument();
    expect(screen.getByText(/UNKNOWN/)).toBeInTheDocument();
  });
});
