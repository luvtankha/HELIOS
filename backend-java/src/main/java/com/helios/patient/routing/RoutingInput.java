package com.helios.patient.routing;

import java.util.List;

public record RoutingInput(
        String complaint,
        List<String> symptoms,
        List<String> knownConditions,
        String injury,
        Integer age,
        String duration,
        String severity,
        ClinicalContext clinicalContext) {

    public record ClinicalContext(
            String anatomicalLocation,
            boolean pregnant,
            boolean currentEmergencySignal) {}

    public static RoutingInput complaint(String complaint) {
        return new RoutingInput(complaint, List.of(), List.of(), null, null, null, null, null);
    }
}

