package com.helios.patient.voice;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.TreeMap;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import tools.jackson.databind.json.JsonMapper;

@Component
public class VoiceRuntimeTicketIssuer {

    private static final int MINIMUM_SECRET_BYTES = 32;
    private static final int MAXIMUM_TTL_SECONDS = 90;

    private final byte[] secret;
    private final int ttlSeconds;
    private final Clock clock;
    private final JsonMapper jsonMapper;

    @Autowired
    public VoiceRuntimeTicketIssuer(
            @Value("${helios.voice.runtime-secret:}") String secret,
            @Value("${helios.voice.runtime-ticket-ttl-seconds:45}") int ttlSeconds,
            JsonMapper jsonMapper) {
        this(secret, ttlSeconds, Clock.systemUTC(), jsonMapper);
    }

    VoiceRuntimeTicketIssuer(String secret, int ttlSeconds, Clock clock, JsonMapper jsonMapper) {
        this.secret = secret == null ? new byte[0] : secret.getBytes(StandardCharsets.UTF_8);
        if (ttlSeconds <= 0 || ttlSeconds > MAXIMUM_TTL_SECONDS) {
            throw new IllegalArgumentException("voice runtime ticket TTL must be between 1 and 90 seconds");
        }
        this.ttlSeconds = ttlSeconds;
        this.clock = clock;
        this.jsonMapper = jsonMapper;
    }

    public boolean configured() {
        return secret.length >= MINIMUM_SECRET_BYTES;
    }

    public Ticket issue(String voiceSessionId, String patientSessionId) {
        if (!configured()) {
            throw new IllegalStateException("voice runtime secret is not configured");
        }
        if (voiceSessionId == null || voiceSessionId.isBlank()
                || patientSessionId == null || patientSessionId.isBlank()) {
            throw new IllegalArgumentException("voiceSessionId and patientSessionId are required");
        }
        long issuedAt = clock.instant().getEpochSecond();
        long expiresAt = issuedAt + ttlSeconds;
        Map<String, Object> payload = new TreeMap<>();
        payload.put("exp", expiresAt);
        payload.put("iat", issuedAt);
        payload.put("patientSessionId", patientSessionId);
        payload.put("voiceSessionId", voiceSessionId);
        try {
            byte[] json = jsonMapper.writeValueAsBytes(payload);
            String payloadSegment = Base64.getUrlEncoder().withoutPadding().encodeToString(json);
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            String signature = Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(mac.doFinal(payloadSegment.getBytes(StandardCharsets.US_ASCII)));
            return new Ticket(payloadSegment + "." + signature, Instant.ofEpochSecond(expiresAt));
        } catch (Exception exception) {
            throw new IllegalStateException("could not issue voice runtime ticket", exception);
        }
    }

    public record Ticket(String credential, Instant expiresAt) {}
}
