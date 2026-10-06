package com.helios.patient.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.util.Base64;
import java.util.HexFormat;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import tools.jackson.databind.json.JsonMapper;

@Component
public class SessionProofCodec {

    private static final String VERSION = "v1";
    private static final String KIND = "patient-session";
    private static final int MAX_TOKEN_LENGTH = 2_048;

    private final byte[] secret;
    private final long ttlSeconds;
    private final Clock clock;
    private final JsonMapper jsonMapper;

    @Autowired
    public SessionProofCodec(
            @Value("${helios.security.session-token-secret}") String secret,
            @Value("${helios.security.patient-session-ttl-seconds:28800}") long ttlSeconds,
            JsonMapper jsonMapper) {
        this(secret, ttlSeconds, Clock.systemUTC(), jsonMapper);
    }

    SessionProofCodec(String secret, long ttlSeconds, Clock clock, JsonMapper jsonMapper) {
        if (secret == null || secret.length() < 16) {
            throw new IllegalArgumentException("session token secret must be at least 16 characters");
        }
        if (ttlSeconds < 300 || ttlSeconds > 86_400) {
            throw new IllegalArgumentException("patient session TTL must be between 300 and 86400 seconds");
        }
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
        this.ttlSeconds = ttlSeconds;
        this.clock = clock;
        this.jsonMapper = jsonMapper;
    }

    public String create(String subject) {
        long issuedAt = clock.instant().getEpochSecond();
        var payload = new TokenPayload(subject, KIND, issuedAt, issuedAt + ttlSeconds);
        try {
            String json = jsonMapper.writeValueAsString(payload);
            String encoded = Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(json.getBytes(StandardCharsets.UTF_8));
            return VERSION + "." + encoded + "." + signature(encoded);
        } catch (Exception exception) {
            throw new IllegalStateException("could not create patient session proof", exception);
        }
    }

    public Verification verify(String token) {
        if (token == null || token.isBlank()) {
            return Verification.missingToken();
        }
        if (token.length() > MAX_TOKEN_LENGTH) {
            return Verification.invalidToken();
        }
        String[] parts = token.split("\\.", -1);
        if (parts.length != 3 || !VERSION.equals(parts[0]) || parts[1].isBlank()
                || !parts[2].matches("[a-f0-9]{64}")) {
            return Verification.invalidToken();
        }
        byte[] supplied;
        byte[] expected;
        try {
            supplied = HexFormat.of().parseHex(parts[2]);
            expected = HexFormat.of().parseHex(signature(parts[1]));
        } catch (IllegalArgumentException exception) {
            return Verification.invalidToken();
        }
        if (!MessageDigest.isEqual(supplied, expected)) {
            return Verification.invalidToken();
        }
        try {
            String json = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
            TokenPayload payload = jsonMapper.readValue(json, TokenPayload.class);
            long now = clock.instant().getEpochSecond();
            if (!KIND.equals(payload.kind()) || payload.sub() == null || payload.sub().isBlank()
                    || payload.iat() > now + 60 || payload.exp() <= payload.iat()) {
                return Verification.invalidToken();
            }
            return new Verification(payload.sub(), payload.exp() <= now, false, true);
        } catch (Exception exception) {
            return Verification.invalidToken();
        }
    }

    private String signature(String encoded) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal((KIND + ":" + encoded).getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("HMAC-SHA256 unavailable", exception);
        }
    }

    record TokenPayload(String sub, String kind, long iat, long exp) {}

    public record Verification(String subject, boolean expired, boolean missing, boolean valid) {
        static Verification missingToken() {
            return new Verification(null, false, true, false);
        }

        static Verification invalidToken() {
            return new Verification(null, false, false, false);
        }
    }
}
