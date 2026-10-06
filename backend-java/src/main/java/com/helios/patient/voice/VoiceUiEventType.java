package com.helios.patient.voice;

public enum VoiceUiEventType {
    SESSION_READY("session.ready"),
    DOCTOR_SPEAKING_STARTED("doctor.speaking.started"),
    DOCTOR_SPEAKING_CAPTION("doctor.speaking.caption"),
    DOCTOR_SPEAKING_ENDED("doctor.speaking.ended"),
    PATIENT_SPEECH_STARTED("patient.speech.started"),
    PATIENT_SPEECH_ENDED("patient.speech.ended"),
    DOCTOR_HANDOFF("doctor.handoff"),
    CONVERSATION_WARNING("conversation.warning"),
    CONVERSATION_COMPLETED("conversation.completed"),
    CONNECTION_DEGRADED("connection.degraded"),
    CONNECTION_RECONNECTING("connection.reconnecting"),
    CONNECTION_RESTORED("connection.restored"),
    SESSION_ENDED("session.ended");

    private final String wireName;

    VoiceUiEventType(String wireName) {
        this.wireName = wireName;
    }

    public String wireName() {
        return wireName;
    }
}
