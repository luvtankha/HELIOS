package com.helios.patient.voice;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import com.helios.patient.intake.FollowUpIntent;

class FollowUpQuestionRealizerTest {

    private final FollowUpQuestionRealizer realizer = new FollowUpQuestionRealizer();

    @Test
    void realizesSafetyIntentWithoutDiagnosisOrTreatmentLanguage() {
        String question = realizer.realize(new FollowUpIntent(
                "chest-breathing",
                "breathingDifficulty",
                "Check breathing difficulty",
                FollowUpIntent.Priority.SAFETY,
                true));

        assertThat(question)
                .contains("saans")
                .doesNotContainIgnoringCase("diagnos")
                .doesNotContainIgnoringCase("medicine")
                .doesNotContainIgnoringCase("treatment");
    }

    @Test
    void supportsCoreAdaptiveIntakeFields() {
        assertThat(realizer.realize(intent("onset"))).contains("kab se");
        assertThat(realizer.realize(intent("severity"))).contains("zero se ten");
        assertThat(realizer.realize(intent("pattern"))).contains("lagataar");
        assertThat(realizer.realize(intent("associatedSymptoms"))).contains("symptom");
    }

    private static FollowUpIntent intent(String field) {
        return new FollowUpIntent(
                "collect-" + field,
                field,
                "Collect " + field,
                FollowUpIntent.Priority.CLINICAL_CONTEXT,
                true);
    }
}
