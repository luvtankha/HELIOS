package com.helios.patient.config;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class ProductionSecurityValidatorTest {

    @Test
    void acceptsStrongDistinctProductionSecretsAndExplicitOrigin() {
        var validator = new ProductionSecurityValidator(
                "session-secret-0123456789-abcdefghij",
                "runtime-secret-0123456789-abcdefghij",
                "control-secret-0123456789-abcdefghij",
                "https://patient.helios.example");

        validator.afterPropertiesSet();
    }

    @Test
    void rejectsWeakOrLocalProductionConfiguration() {
        assertThatThrownBy(() -> new ProductionSecurityValidator(
                "short",
                "runtime-secret-0123456789-abcdefghij",
                "control-secret-0123456789-abcdefghij",
                "https://patient.helios.example").afterPropertiesSet())
                .isInstanceOf(IllegalStateException.class);

        assertThatThrownBy(() -> new ProductionSecurityValidator(
                "session-secret-0123456789-abcdefghij",
                "same-secret-0123456789-abcdefghijkl",
                "same-secret-0123456789-abcdefghijkl",
                "http://localhost:3000").afterPropertiesSet())
                .isInstanceOf(IllegalStateException.class);
    }
}
