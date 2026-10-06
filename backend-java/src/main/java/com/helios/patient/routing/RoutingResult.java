package com.helios.patient.routing;

import java.util.List;

public record RoutingResult(
        String primarySpecialization,
        List<String> alternativeSpecializations,
        double confidence,
        String confidenceBand,
        String confidenceMeaning,
        String urgency,
        boolean emergencyEscalation,
        List<String> matchedConditions,
        List<String> matchedSymptoms,
        List<String> emergencyRuleIds,
        String reason,
        String limitations,
        String version) {}

