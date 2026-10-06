package com.helios.patient.voice;

import java.time.Instant;
import java.util.Map;

public record VoiceUiEvent(
        String eventId,
        String voiceSessionId,
        long sequence,
        String type,
        Instant occurredAt,
        Map<String, Object> payload) {}
