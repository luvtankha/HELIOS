package com.helios.patient.voice;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;

import org.junit.jupiter.api.Test;

class VoiceEventStreamServiceTest {

    @Test
    void publishesPublicEventsWithMonotonicSequence() {
        var service = new VoiceEventStreamService(
                Clock.fixed(Instant.parse("2026-10-04T00:00:00Z"), ZoneOffset.UTC));
        String sessionId = "voice-1";
        service.open(sessionId);

        VoiceUiEvent first = service.publish(
                sessionId, VoiceUiEventType.DOCTOR_SPEAKING_STARTED,
                Map.of("doctorAvatarId", "lead-general"));
        VoiceUiEvent second = service.publish(
                sessionId, VoiceUiEventType.DOCTOR_SPEAKING_CAPTION,
                Map.of("text", "Aapko pain kab se hai?"));

        assertThat(first.type()).isEqualTo("doctor.speaking.started");
        assertThat(first.sequence()).isEqualTo(1);
        assertThat(second.sequence()).isEqualTo(2);
        assertThat(second.payload()).containsEntry("text", "Aapko pain kab se hai?");

        var replayed = service.stream(sessionId, 1).take(1).collectList().block();
        assertThat(replayed).containsExactly(second);
    }
}
