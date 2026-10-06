import { describe, expect, it } from "vitest";
import {
  consultationEventFromEnvelope,
  initialConsultationState,
  reduceConsultation,
} from "./live-consultation-state";

describe("live consultation state", () => {
  it("does not let local media state advance the authoritative event sequence", () => {
    const localSpeaking = reduceConsultation(initialConsultationState, {
      type: "doctor.speaking.started",
      sequence: 0,
      doctorAvatarId: "lead-general",
      local: true,
    });
    expect(localSpeaking.phase).toBe("doctor-speaking");
    expect(localSpeaking.sequence).toBe(0);

    const authoritative = reduceConsultation(localSpeaking, {
      type: "doctor.handoff",
      sequence: 1,
      toAvatarId: "clinician-female",
    });
    expect(authoritative.activeDoctorId).toBe("clinician-female");
    expect(authoritative.sequence).toBe(1);
  });

  it("shows a speech bubble only while the doctor is speaking", () => {
    const speaking = reduceConsultation(initialConsultationState, {
      type: "doctor.speaking.started",
      sequence: 1,
      doctorAvatarId: "lead-general",
    });
    const captioned = reduceConsultation(speaking, {
      type: "doctor.speaking.caption",
      sequence: 2,
      text: "Aapko pressure kab se feel ho raha hai?",
    });
    const listening = reduceConsultation(captioned, {
      type: "patient.speech.started",
      sequence: 3,
    });

    expect(captioned.speechBubble).toContain("pressure");
    expect(listening.phase).toBe("listening");
    expect(listening.speechBubble).toBeNull();
  });

  it("supports doctor handoff without resetting the session sequence", () => {
    const state = reduceConsultation(initialConsultationState, {
      type: "doctor.handoff",
      sequence: 9,
      toAvatarId: "clinician-female",
    });
    expect(state.activeDoctorId).toBe("clinician-female");
    expect(state.phase).toBe("handoff");
    expect(state.sequence).toBe(9);
  });

  it("ignores duplicate or stale realtime events", () => {
    const state = { ...initialConsultationState, sequence: 10 };
    expect(
      reduceConsultation(state, {
        type: "session.ended",
        sequence: 10,
      }),
    ).toBe(state);
  });

  it("models degraded/recovered connection without exposing pipeline stages", () => {
    const degraded = reduceConsultation(initialConsultationState, {
      type: "connection.degraded",
      sequence: 1,
      message: "Network unstable",
    });
    const restored = reduceConsultation(degraded, {
      type: "connection.restored",
      sequence: 2,
    });

    expect(degraded.phase).toBe("reconnecting");
    expect(degraded.warning).toBe("Network unstable");
    expect(restored.phase).toBe("listening");
    expect(restored.warning).toBeNull();
  });

  it("accepts patient speech end as a public realtime event", () => {
    const state = reduceConsultation(initialConsultationState, {
      type: "patient.speech.ended",
      sequence: 1,
    });
    expect(state.phase).toBe("listening");
    expect(state.sequence).toBe(1);
  });

  it("maps only the public server envelope into UI state events", () => {
    expect(
      consultationEventFromEnvelope({
        eventId: "event-1",
        voiceSessionId: "voice-1",
        sequence: 7,
        type: "doctor.handoff",
        occurredAt: "2026-10-04T00:00:00Z",
        payload: { toAvatarId: "clinician-female" },
      }),
    ).toEqual({ type: "doctor.handoff", sequence: 7, toAvatarId: "clinician-female" });
    expect(
      consultationEventFromEnvelope({
        eventId: "event-2",
        voiceSessionId: "voice-1",
        sequence: 8,
        type: "internal.transcription.partial",
        occurredAt: "2026-10-04T00:00:01Z",
        payload: { text: "hidden" },
      }),
    ).toBeNull();
  });
});
