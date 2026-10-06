package com.helios.patient.config;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("prod")
public class ProductionSecurityValidator implements InitializingBean {

    private final String sessionSecret;
    private final String runtimeSecret;
    private final String controlSecret;
    private final String allowedOrigins;

    public ProductionSecurityValidator(
            @Value("${helios.security.session-token-secret:}") String sessionSecret,
            @Value("${helios.voice.runtime-secret:}") String runtimeSecret,
            @Value("${helios.voice.control-secret:}") String controlSecret,
            @Value("${helios.security.allowed-origins:}") String allowedOrigins) {
        this.sessionSecret = sessionSecret;
        this.runtimeSecret = runtimeSecret;
        this.controlSecret = controlSecret;
        this.allowedOrigins = allowedOrigins;
    }

    @Override
    public void afterPropertiesSet() {
        requireStrongSecret("SESSION_TOKEN_SECRET", sessionSecret);
        requireStrongSecret("HELIOS_VOICE_RUNTIME_SECRET", runtimeSecret);
        requireStrongSecret("HELIOS_VOICE_CONTROL_SECRET", controlSecret);
        if (runtimeSecret.equals(controlSecret)) {
            throw new IllegalStateException(
                    "HELIOS_VOICE_RUNTIME_SECRET and HELIOS_VOICE_CONTROL_SECRET must be different");
        }
        if (allowedOrigins == null
                || allowedOrigins.isBlank()
                || allowedOrigins.contains("localhost")
                || allowedOrigins.contains("*")) {
            throw new IllegalStateException(
                    "HELIOS_ALLOWED_ORIGINS must contain explicit non-local production origins");
        }
    }

    private static void requireStrongSecret(String name, String value) {
        if (value == null || value.length() < 32) {
            throw new IllegalStateException(name + " must be at least 32 characters in production");
        }
        String normalized = value.toLowerCase(java.util.Locale.ROOT);
        if (normalized.contains("replace")
                || normalized.contains("changeme")
                || normalized.contains("default")
                || normalized.contains("local-secret")) {
            throw new IllegalStateException(name + " contains a known placeholder value");
        }
    }
}
