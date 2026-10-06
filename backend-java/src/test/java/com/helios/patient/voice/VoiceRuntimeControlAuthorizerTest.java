package com.helios.patient.voice;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class VoiceRuntimeControlAuthorizerTest {

    @Test
    void acceptsOnlyExactBearerControlSecret() {
        var authorizer = new VoiceRuntimeControlAuthorizer("control-secret");

        authorizer.require("Bearer control-secret");

        assertThatThrownBy(() -> authorizer.require("Bearer wrong"))
                .isInstanceOfSatisfying(
                        ResponseStatusException.class,
                        exception -> org.assertj.core.api.Assertions.assertThat(exception.getStatusCode())
                                .isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    @Test
    void failsClosedWhenControlPlaneSecretIsNotConfigured() {
        var authorizer = new VoiceRuntimeControlAuthorizer("");

        assertThatThrownBy(() -> authorizer.require("Bearer anything"))
                .isInstanceOfSatisfying(
                        ResponseStatusException.class,
                        exception -> org.assertj.core.api.Assertions.assertThat(exception.getStatusCode())
                                .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
    }
}
