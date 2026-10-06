package com.helios.patient.voice;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class VoiceRuntimeControlAuthorizer {

    private final String secret;

    public VoiceRuntimeControlAuthorizer(
            @Value("${helios.voice.control-secret:}") String secret) {
        this.secret = secret == null ? "" : secret;
    }

    public void require(String authorization) {
        if (secret.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "voice runtime control plane is not configured");
        }
        if (!("Bearer " + secret).equals(authorization)) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "invalid voice runtime control credential");
        }
    }
}
