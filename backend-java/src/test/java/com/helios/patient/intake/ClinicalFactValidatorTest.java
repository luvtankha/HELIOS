package com.helios.patient.intake;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;

class ClinicalFactValidatorTest {

    private final ClinicalFactValidator validator = new ClinicalFactValidator();

    @Test
    void acceptsBoundedPatientReportedFactWithProvenance() {
        IntakeFact fact = validator.validate(candidate("onset", "since morning"));
        assertThat(fact.field()).isEqualTo("onset");
        assertThat(fact.evidenceTurnIds()).containsExactly("turn-12");
    }

    @Test
    void rejectsDiagnosisOrTreatmentAsClinicalFactFields() {
        assertThatThrownBy(() -> validator.validate(candidate("diagnosis", "heart attack")))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> validator.validate(candidate("treatment", "take medicine")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsFactWithoutPatientTurnEvidence() {
        ClinicalFactCandidate candidate = new ClinicalFactCandidate(
                "severity", "7/10", KnowledgeState.KNOWN, "HIGH", "PATIENT_REPORTED",
                List.of(), "candidate-model", "v1", "helios-policy-v1");
        assertThatThrownBy(() -> validator.validate(candidate)).isInstanceOf(IllegalArgumentException.class);
    }

    private static ClinicalFactCandidate candidate(String field, String value) {
        return new ClinicalFactCandidate(
                field, value, KnowledgeState.KNOWN, "HIGH", "PATIENT_REPORTED",
                List.of("turn-12"), "candidate-model", "v1", "helios-policy-v1");
    }

    @Test
    void keepsClinicalLogValuesInEnglishOrRomanHinglish() {
        assertThatThrownBy(() -> validator.validate(candidate("chiefComplaint", "सीने में दर्द")))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(validator.validate(candidate("chiefComplaint", "seene mein dard")).value())
                .isEqualTo("seene mein dard");
    }
}
