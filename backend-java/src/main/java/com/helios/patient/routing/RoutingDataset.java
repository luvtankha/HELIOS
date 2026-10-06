package com.helios.patient.routing;

import java.util.List;

public record RoutingDataset(
        String version,
        List<Mapping> mappings,
        List<EmergencyRule> emergencyRules) {

    public record Mapping(
            String id,
            List<String> aliases,
            List<String> symptomKeywords,
            List<String> injuryKeywords,
            String primarySpecialization,
            List<String> secondarySpecializations,
            String urgencyDefault,
            String ageGroup,
            boolean active,
            List<List<String>> requiredGroups,
            int minSignals,
            int priority) {}

    public record EmergencyRule(String id, List<List<String>> groups) {}
}

