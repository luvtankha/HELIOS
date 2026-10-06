package com.helios.patient.voice;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;

import tools.jackson.databind.json.JsonMapper;

class VoiceRuntimeTicketIssuerTest {

    @Test
    void issuesPythonCompatibleShortLivedTicketShape() {
        var issuer = new VoiceRuntimeTicketIssuer(
                "voice-runtime-secret-for-tests-1234567890",
                45,
                Clock.fixed(Instant.ofEpochSecond(1_000), ZoneOffset.UTC),
                JsonMapper.builder().build());

        var ticket = issuer.issue("voice-1", "patient-1");

        // Exact vector produced by the Python VoiceRuntimeTicketCodec.
        assertThat(ticket.credential()).isEqualTo(
                "eyJleHAiOjEwNDUsImlhdCI6MTAwMCwicGF0aWVudFNlc3Npb25JZCI6InBhdGllbnQtMSIsInZvaWNlU2Vzc2lvbklkIjoidm9pY2UtMSJ9.-U4YLY3FT2pfQQyS-bZle2ojcnABpeQdkOIQQa8MJiU");
        assertThat(ticket.expiresAt()).isEqualTo(Instant.ofEpochSecond(1_045));
        assertThat(issuer.configured()).isTrue();
    }

    @Test
    void refusesToIssueWhenSecretIsTooShort() {
        var issuer = new VoiceRuntimeTicketIssuer(
                "short",
                45,
                Clock.fixed(Instant.ofEpochSecond(1_000), ZoneOffset.UTC),
                JsonMapper.builder().build());

        assertThat(issuer.configured()).isFalse();
    }
}
