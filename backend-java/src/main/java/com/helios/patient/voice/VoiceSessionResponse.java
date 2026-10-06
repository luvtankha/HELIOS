package com.helios.patient.voice;

import java.time.Instant;

public record VoiceSessionResponse(
        String voiceSessionId,
        String patientSessionId,
        String visitId,
        String state,
        Media media,
        Conversation conversation,
        long lastAcknowledgedSequence,
        Instant createdAt) {

    public record Media(
            boolean available,
            String transport,
            String websocketUrl,
            String credential,
            Instant expiresAt,
            String detail) {}

    public record Conversation(String languageMode, String doctorAvatarId, boolean bargeIn) {}
}
