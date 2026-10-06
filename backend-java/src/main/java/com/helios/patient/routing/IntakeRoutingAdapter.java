package com.helios.patient.routing;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Component;

import com.helios.patient.intake.IntakeFact;
import com.helios.patient.intake.IntakeSnapshot;

@Component
public class IntakeRoutingAdapter {

    public RoutingInput fromValidatedIntake(IntakeSnapshot snapshot, Integer age) {
        List<String> symptoms = new ArrayList<>(snapshot.symptomTerms() == null ? List.of() : snapshot.symptomTerms());
        // Preserve patient statements (including negations) in separate clauses.
        // These captured follow-ups previously never reached the emergency rules.
        for (String field : List.of("associatedSymptoms", "breathingDifficulty", "faintingOrSweating",
                "radiatingDiscomfort", "suddenSevereOnset", "neurologicalSymptoms",
                "severeAbdominalFeatures", "gastrointestinalSymptoms", "pattern", "character")) {
            String reported = value(snapshot, field);
            if (reported != null && !reported.isBlank()) symptoms.add(reported);
        }
        List<String> knownConditions = values(snapshot, "pastMedicalHistory");
        return new RoutingInput(
                snapshot.chiefComplaint(),
                List.copyOf(symptoms),
                knownConditions,
                value(snapshot, "injury"),
                age,
                value(snapshot, "duration") != null ? value(snapshot, "duration") : value(snapshot, "onset"),
                value(snapshot, "severity"),
                new RoutingInput.ClinicalContext(
                        value(snapshot, "location"),
                        "true".equalsIgnoreCase(value(snapshot, "pregnant")),
                        "true".equalsIgnoreCase(value(snapshot, "currentEmergencySignal"))));
    }

    private static String value(IntakeSnapshot snapshot, String field) {
        IntakeFact fact = snapshot.fact(field);
        return fact != null && fact.sufficientlyKnown() ? fact.value() : null;
    }

    private static List<String> values(IntakeSnapshot snapshot, String field) {
        String value = value(snapshot, field);
        if (value == null || value.isBlank()) return List.of();
        List<String> values = new ArrayList<>();
        for (String part : value.split("[,;]")) {
            String trimmed = part.trim();
            if (!trimmed.isEmpty()) values.add(trimmed);
        }
        return List.copyOf(values);
    }
}
