package com.helios.patient.intake;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

class FollowUpPolicyEngineTest {

    private final FollowUpPolicyEngine engine = new FollowUpPolicyEngine();

    @Test
    void hinglishChestSymptomsKeepRelevantSafetyQuestions() {
        assertThat(engine.next(snapshot("seene mein dard", Map.of())).nextIntent().targetField())
                .isEqualTo("breathingDifficulty");
        assertThat(engine.next(snapshot("loss of appetite", Map.of())).nextIntent().targetField())
                .isEqualTo("chiefComplaint");
    }

    @Test
    void chestConcernPrioritizesMissingSafetyContextBeforeGenericQuestions() {
        FollowUpDecision decision = engine.next(snapshot("Mere chest mein pressure hai", Map.of()));
        assertThat(decision.nextIntent().priority()).isEqualTo(FollowUpIntent.Priority.SAFETY);
        assertThat(decision.nextIntent().targetField()).isEqualTo("breathingDifficulty");
    }

    @Test
    void doesNotReaskAlreadyKnownSafetyFact() {
        Map<String, IntakeFact> facts = new HashMap<>();
        facts.put("breathingDifficulty", known("breathingDifficulty", "no"));
        FollowUpDecision decision = engine.next(snapshot("chest pressure", facts));
        assertThat(decision.nextIntent().targetField()).isEqualTo("faintingOrSweating");
    }

    @Test
    void conflictClarificationPrecedesOtherFollowups() {
        Map<String, IntakeFact> facts = new HashMap<>();
        facts.put("onset", new IntakeFact("onset", KnowledgeState.CONFLICT, null, "LOW", List.of("t1", "t4")));
        FollowUpDecision decision = engine.next(snapshot("pet mein dard", facts));
        assertThat(decision.nextIntent().priority()).isEqualTo(FollowUpIntent.Priority.CLARIFICATION);
        assertThat(decision.nextIntent().targetField()).isEqualTo("onset");
    }

    @Test
    void rejectsModelIntentThatAttemptsDiagnosis() {
        FollowUpIntent proposed = new FollowUpIntent(
                "diagnose-heart-attack", "diagnosis", "diagnosis recommendation", FollowUpIntent.Priority.CLINICAL_CONTEXT, false);
        assertThat(engine.allowsModelIntent(snapshot("chest pressure", Map.of()), proposed)).isFalse();
    }

    @Test
    void completesOnlyAfterRequiredCoverage() {
        Map<String, IntakeFact> facts = new HashMap<>();
        for (String field : List.of(
                "breathingDifficulty", "faintingOrSweating", "radiatingDiscomfort",
                "onset", "severity", "pattern", "associatedSymptoms", "aggravatingRelievingFactors")) {
            facts.put(field, known(field, "reported"));
        }
        FollowUpDecision missingComplaint = engine.next(snapshot("chest pressure", facts));
        assertThat(missingComplaint.complete()).isFalse();
        assertThat(missingComplaint.nextIntent().targetField()).isEqualTo("chiefComplaint");
        facts.put("chiefComplaint", known("chiefComplaint", "chest pressure"));
        FollowUpDecision decision = engine.next(snapshot("chest pressure", facts));
        assertThat(decision.complete()).isTrue();
        assertThat(decision.nextIntent()).isNull();
    }

    private static IntakeSnapshot snapshot(String complaint, Map<String, IntakeFact> facts) {
        return new IntakeSnapshot(complaint, facts, List.of(), 3);
    }

    @Test
    void doesNotRepeatedlyAskAnExplicitlyUnknownAnswer() {
        Map<String, IntakeFact> facts = new HashMap<>();
        facts.put("chiefComplaint", known("chiefComplaint", "fatigue"));
        facts.put("onset", new IntakeFact("onset", KnowledgeState.UNKNOWN, null, "LOW", List.of("t1")));
        assertThat(engine.next(snapshot("fatigue", facts)).nextIntent().targetField()).isEqualTo("severity");
    }

    private static IntakeFact known(String field, String value) {
        return new IntakeFact(field, KnowledgeState.KNOWN, value, "HIGH", List.of("t1"));
    }
}
