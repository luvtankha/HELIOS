export type ConsultationPhase =
  | "connecting"
  | "doctor-speaking"
  | "listening"
  | "handoff"
  | "reconnecting"
  | "complete"
  | "error";

export interface LiveConsultationState {
  phase: ConsultationPhase;
  activeDoctorId: string;
  speechBubble: string | null;
  warning: string | null;
  sequence: number;
}

export type ConsultationEvent =
  | {
      type: "session.ready";
      sequence: number;
      doctorAvatarId: string;
      local?: boolean;
    }
  | {
      type: "doctor.speaking.started";
      sequence: number;
      doctorAvatarId?: string;
      local?: boolean;
    }
  | {
      type: "doctor.speaking.caption";
      sequence: number;
      text: string;
      local?: boolean;
    }
  | { type: "doctor.speaking.ended"; sequence: number; local?: boolean }
  | { type: "patient.speech.started"; sequence: number; local?: boolean }
  | { type: "patient.speech.ended"; sequence: number; local?: boolean }
  | {
      type: "doctor.handoff";
      sequence: number;
      toAvatarId: string;
      local?: boolean;
    }
  | {
      type: "conversation.warning";
      sequence: number;
      message: string;
      local?: boolean;
    }
  | {
      type: "connection.degraded";
      sequence: number;
      message?: string;
      local?: boolean;
    }
  | { type: "connection.reconnecting"; sequence: number; local?: boolean }
  | { type: "connection.restored"; sequence: number; local?: boolean }
  | { type: "conversation.completed"; sequence: number; local?: boolean }
  | {
      type: "session.ended";
      sequence: number;
      reason?: string;
      local?: boolean;
    };

export const initialConsultationState: LiveConsultationState = {
  phase: "connecting",
  activeDoctorId: "lead-general",
  speechBubble: null,
  warning: null,
  sequence: 0,
};

export function reduceConsultation(
  state: LiveConsultationState,
  event: ConsultationEvent,
): LiveConsultationState {
  if (!event.local && event.sequence <= state.sequence) return state;
  if (state.phase === "complete" && event.type !== "session.ready")
    return state;
  const sequence = event.local ? state.sequence : event.sequence;

  switch (event.type) {
    case "session.ready":
      return {
        ...state,
        phase: "listening",
        activeDoctorId: event.doctorAvatarId,
        speechBubble: null,
        warning: null,
        sequence,
      };
    case "doctor.speaking.started":
      return {
        ...state,
        phase: "doctor-speaking",
        activeDoctorId: event.doctorAvatarId ?? state.activeDoctorId,
        speechBubble: state.speechBubble ?? "",
        sequence,
      };
    case "doctor.speaking.caption":
      return {
        ...state,
        phase: "doctor-speaking",
        speechBubble: event.text,
        sequence,
      };
    case "doctor.speaking.ended":
    case "patient.speech.started":
    case "patient.speech.ended":
      return {
        ...state,
        phase: "listening",
        speechBubble: null,
        sequence,
      };
    case "doctor.handoff":
      return {
        ...state,
        phase: "handoff",
        activeDoctorId: event.toAvatarId,
        speechBubble: null,
        sequence,
      };
    case "conversation.warning":
      return {
        ...state,
        warning: event.message,
        sequence,
      };
    case "connection.degraded":
      return {
        ...state,
        phase: "reconnecting",
        speechBubble: null,
        warning: event.message ?? "Live connection degraded",
        sequence,
      };
    case "connection.reconnecting":
      return {
        ...state,
        phase: "reconnecting",
        speechBubble: null,
        sequence,
      };
    case "connection.restored":
      return {
        ...state,
        phase: "listening",
        warning: null,
        sequence,
      };
    case "conversation.completed":
      return {
        ...state,
        phase: "complete",
        speechBubble: null,
        sequence,
      };
    case "session.ended":
      return {
        ...state,
        phase: event.reason ? "error" : "complete",
        speechBubble: null,
        warning: event.reason ?? null,
        sequence,
      };
  }
}

export function consultationEventFromEnvelope(
  envelope: V2VoiceEventEnvelope,
): ConsultationEvent | null {
  const sequence = envelope.sequence;
  const stringPayload = (key: string) => {
    const value = envelope.payload[key];
    return typeof value === "string" && value.length > 0 ? value : null;
  };

  switch (envelope.type) {
    case "session.ready": {
      const doctorAvatarId = stringPayload("doctorAvatarId");
      return doctorAvatarId
        ? { type: envelope.type, sequence, doctorAvatarId }
        : null;
    }
    case "doctor.speaking.started": {
      const doctorAvatarId = stringPayload("doctorAvatarId");
      return doctorAvatarId
        ? { type: envelope.type, sequence, doctorAvatarId }
        : null;
    }
    case "doctor.speaking.caption": {
      const text = stringPayload("text");
      return text ? { type: envelope.type, sequence, text } : null;
    }
    case "doctor.speaking.ended":
    case "patient.speech.started":
    case "patient.speech.ended":
    case "connection.reconnecting":
    case "connection.restored":
    case "conversation.completed":
      return { type: envelope.type, sequence };
    case "doctor.handoff": {
      const toAvatarId = stringPayload("toAvatarId");
      return toAvatarId ? { type: envelope.type, sequence, toAvatarId } : null;
    }
    case "conversation.warning": {
      const message = stringPayload("message");
      return message ? { type: envelope.type, sequence, message } : null;
    }
    case "connection.degraded":
      return {
        type: envelope.type,
        sequence,
        ...(stringPayload("message")
          ? { message: stringPayload("message")! }
          : {}),
      };
    case "session.ended":
      return {
        type: envelope.type,
        sequence,
        ...(stringPayload("reason")
          ? { reason: stringPayload("reason")! }
          : {}),
      };
    default:
      return null;
  }
}
import type { V2VoiceEventEnvelope } from "@/services/patient-v2";
