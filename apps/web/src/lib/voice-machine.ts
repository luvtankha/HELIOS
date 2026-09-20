import type { VoiceInteractionDto } from "@helios/shared";

export type VoiceStateName =
  | "IDLE"
  | "PERMISSION_REQUEST"
  | "READY"
  | "RECORDING"
  | "STOPPING"
  | "UPLOADING"
  | "TRANSCRIBING"
  | "TRANSCRIBED"
  | "AWAITING_CONFIRMATION"
  | "EDITING"
  | "CONFIRMED"
  | "ERROR";

export interface VoiceMachineState {
  status: VoiceStateName;
  elapsedSeconds: number;
  uploadProgress: number;
  levels: number[];
  interaction?: VoiceInteractionDto;
  errorCode?: string;
  errorMessage?: string;
}

export type VoiceMachineEvent =
  | { type: "REQUEST_PERMISSION" }
  | { type: "PERMISSION_GRANTED" }
  | { type: "START_RECORDING" }
  | { type: "TICK" }
  | { type: "LEVELS"; levels: number[] }
  | { type: "STOP" }
  | { type: "UPLOAD" }
  | { type: "UPLOAD_PROGRESS"; progress: number }
  | { type: "TRANSCRIBE" }
  | { type: "TRANSCRIPTION_COMPLETE"; interaction: VoiceInteractionDto }
  | { type: "AWAIT_CONFIRMATION" }
  | { type: "EDIT" }
  | { type: "EDIT_SAVED"; interaction: VoiceInteractionDto }
  | { type: "CONFIRMED"; interaction: VoiceInteractionDto }
  | { type: "FAIL"; code: string; message: string }
  | { type: "RESET" };

export const initialVoiceState: VoiceMachineState = {
  status: "IDLE",
  elapsedSeconds: 0,
  uploadProgress: 0,
  levels: Array.from({ length: 12 }, () => 0.2),
};

export function voiceMachineReducer(
  state: VoiceMachineState,
  event: VoiceMachineEvent,
): VoiceMachineState {
  switch (event.type) {
    case "REQUEST_PERMISSION":
      return { ...initialVoiceState, status: "PERMISSION_REQUEST" };
    case "PERMISSION_GRANTED":
      return { ...state, status: "READY" };
    case "START_RECORDING":
      return { ...state, status: "RECORDING", elapsedSeconds: 0 };
    case "TICK":
      return { ...state, elapsedSeconds: state.elapsedSeconds + 1 };
    case "LEVELS":
      return { ...state, levels: event.levels };
    case "STOP":
      return { ...state, status: "STOPPING" };
    case "UPLOAD":
      return { ...state, status: "UPLOADING", uploadProgress: 0 };
    case "UPLOAD_PROGRESS":
      return { ...state, uploadProgress: event.progress };
    case "TRANSCRIBE":
      return { ...state, status: "TRANSCRIBING", uploadProgress: 100 };
    case "TRANSCRIPTION_COMPLETE":
      return {
        ...state,
        status: "TRANSCRIBED",
        interaction: event.interaction,
      };
    case "AWAIT_CONFIRMATION":
      return { ...state, status: "AWAITING_CONFIRMATION" };
    case "EDIT":
      return { ...state, status: "EDITING" };
    case "EDIT_SAVED":
      return {
        ...state,
        status: "AWAITING_CONFIRMATION",
        interaction: event.interaction,
      };
    case "CONFIRMED":
      return { ...state, status: "CONFIRMED", interaction: event.interaction };
    case "FAIL":
      return {
        ...state,
        status: "ERROR",
        errorCode: event.code,
        errorMessage: event.message,
      };
    case "RESET":
      return initialVoiceState;
  }
}
