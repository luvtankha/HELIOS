package com.helios.patient.routing;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import tools.jackson.databind.json.JsonMapper;

class SpecializationRoutingEngineTest {

    private SpecializationRoutingEngine engine;

    @BeforeEach
    void setUp() {
        engine = new SpecializationRoutingEngine(new RoutingDatasetLoader(JsonMapper.builder().build()));
    }

    @Test
    void preservesRepresentativeV1RoutingParity() {
        assertThat(route("fractured wrist after a fall").primarySpecialization()).isEqualTo("orthopaedics");
        assertThat(route("itchy red rash for several days").primarySpecialization()).isEqualTo("dermatology");
        assertThat(route("persistent migraine with aura").primarySpecialization()).isEqualTo("neurology");
        assertThat(route("kidney stone").primarySpecialization()).isEqualTo("urology");
        assertThat(route("known chronic kidney disease").primarySpecialization()).isEqualTo("nephrology");
        assertThat(route("thyroid problem").primarySpecialization()).isEqualTo("endocrinology");
        assertThat(route("tooth pain and gum bleeding").primarySpecialization()).isEqualTo("dentistry");
    }

    @Test
    void preservesNegationAndHistoricEmergencyGuards() {
        assertThat(route("I do not have chest pain, just need a refill").emergencyEscalation()).isFalse();
        assertThat(route("My father had crushing chest pain years ago; I have a skin rash").emergencyEscalation()).isFalse();
    }

    @Test
    void emergencyPolicyOverridesRoutineSpecialtyRouting() {
        RoutingResult result = route("severe crushing chest pain with sweating and difficulty breathing");
        assertThat(result.primarySpecialization()).isEqualTo("emergency-medicine");
        assertThat(result.urgency()).isEqualTo("emergency");
        assertThat(result.emergencyEscalation()).isTrue();
        assertThat(result.reason()).doesNotContainIgnoringCase("you have");
    }

    @Test
    void existingHighRiskSignalEscalatesWithoutDiagnosis() {
        RoutingInput input = new RoutingInput(
                "a rash", List.of(), List.of(), null, null, null, null,
                new RoutingInput.ClinicalContext(null, false, true));
        RoutingResult result = engine.route(input);
        assertThat(result.emergencyRuleIds()).contains("existing-high-risk-signal");
        assertThat(result.reason()).doesNotContainIgnoringCase("you have");
    }

    @Test
    void childUsesPediatricStartingPointAndRetainsSpecialistAlternative() {
        RoutingInput input = new RoutingInput(
                "itchy red rash for several days", List.of(), List.of(), null, 8, null, null, null);
        RoutingResult result = engine.route(input);
        assertThat(result.primarySpecialization()).isEqualTo("pediatrics");
        assertThat(result.alternativeSpecializations()).contains("dermatology");
    }

    @Test
    void vagueConcernFallsBackConservatively() {
        RoutingResult result = route("I do not feel well");
        assertThat(result.primarySpecialization()).isEqualTo("internal-medicine");
        assertThat(result.confidenceBand()).isEqualTo("low");
        assertThat(result.confidenceMeaning()).isEqualTo("heuristic_match_not_probability");
    }

    @Test
    void preservesFuzzyAndPluralMatching() {
        assertThat(route("fracturd wrist after fall").primarySpecialization()).isEqualTo("orthopaedics");
        assertThat(SpecializationRoutingEngine.matches("red rashes everywhere", "rash")).isTrue();
    }

    private RoutingResult route(String complaint) {
        return engine.route(RoutingInput.complaint(complaint));
    }
}
