import type { VoiceInteractionDto } from "@helios/shared";
import { describe, expect, it } from "vitest";
import { initialVoiceState, voiceMachineReducer } from "./voice-machine";

const interaction: VoiceInteractionDto = {
  id: "voice-1",
  sessionId: "session-1",
  selectedLanguage: "en",
  originalTranscript: "I have stomach pain.",
  confidenceBand: "HIGH",
  status: "TRANSCRIBED",
  startedAt: new Date(0).toISOString(),
};

describe("voice recording state machine", () => {
  it("follows the successful recording and confirmation path", () => {
    let state = voiceMachineReducer(initialVoiceState, {
      type: "REQUEST_PERMISSION",
    });
    state = voiceMachineReducer(state, { type: "PERMISSION_GRANTED" });
    state = voiceMachineReducer(state, { type: "START_RECORDING" });
    state = voiceMachineReducer(state, { type: "TICK" });
    state = voiceMachineReducer(state, { type: "STOP" });
    state = voiceMachineReducer(state, { type: "UPLOAD" });
    state = voiceMachineReducer(state, { type: "TRANSCRIBE" });
    state = voiceMachineReducer(state, {
      type: "TRANSCRIPTION_COMPLETE",
      interaction,
    });
    state = voiceMachineReducer(state, { type: "AWAIT_CONFIRMATION" });
    expect(state.status).toBe("AWAITING_CONFIRMATION");
    state = voiceMachineReducer(state, {
      type: "CONFIRMED",
      interaction: { ...interaction, status: "CONFIRMED" },
    });
    expect(state.status).toBe("CONFIRMED");
  });

  it("supports failure and a clean retry", () => {
    const failed = voiceMachineReducer(initialVoiceState, {
      type: "FAIL",
      code: "MICROPHONE_DENIED",
      message: "Permission denied",
    });
    expect(failed.status).toBe("ERROR");
    expect(voiceMachineReducer(failed, { type: "RESET" })).toEqual(
      initialVoiceState,
    );
  });

  it("keeps editing as an explicit state", () => {
    const ready = {
      ...initialVoiceState,
      status: "AWAITING_CONFIRMATION" as const,
      interaction,
    };
    expect(voiceMachineReducer(ready, { type: "EDIT" }).status).toBe("EDITING");
  });
});
