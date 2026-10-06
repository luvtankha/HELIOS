package com.helios.patient.patient.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;

class IdentityCandidateValidatorTest {

    private final IdentityCandidateValidator validator = new IdentityCandidateValidator();

    @Test
    void normalizesAllowedVoiceIdentityFields() {
        assertThat(validator.validate(candidate("fullName", "  Luv   Tankha ")).value())
                .isEqualTo("Luv Tankha");
        assertThat(validator.validate(candidate("age", "21 years")).value())
                .isEqualTo("21");
        assertThat(validator.validate(candidate("sex", "पुरुष")).value())
                .isEqualTo("MALE");
        assertThat(validator.validate(candidate("phone", "+91 81781 85449")).value())
                .isEqualTo("+918178185449");
    }

    @Test
    void rejectsUntrustedOrInvalidIdentityCandidates() {
        for (String age : List.of("-5", "2.5", "20 or 30", "12abc", "999")) {
            assertThatThrownBy(() -> validator.validate(candidate("age", age))).isInstanceOf(IllegalArgumentException.class);
        }
        assertThatThrownBy(() -> validator.validate(candidate(null, "Delhi"))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> validator.validate(candidate("age", "999")))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> validator.validate(candidate("address", "Delhi")))
                .isInstanceOf(IllegalArgumentException.class);
        IdentityCandidate wrongSource = new IdentityCandidate(
                "fullName",
                "Luv Tankha",
                "HIGH",
                "MODEL_INFERRED",
                List.of("turn-1"),
                "VoiceArena/Human-1",
                "test",
                "helios-v2-policy-1");
        assertThatThrownBy(() -> validator.validate(wrongSource))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private static IdentityCandidate candidate(String field, String value) {
        return new IdentityCandidate(
                field,
                value,
                "HIGH",
                "PATIENT_REPORTED",
                List.of("turn-1"),
                "VoiceArena/Human-1",
                "test",
                "helios-v2-policy-1");
    }
}
