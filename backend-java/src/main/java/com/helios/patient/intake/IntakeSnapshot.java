package com.helios.patient.intake;

import java.util.List;
import java.util.Map;

public record IntakeSnapshot(
        String chiefComplaint,
        Map<String, IntakeFact> facts,
        List<String> symptomTerms,
        int completedTurns) {

    public IntakeFact fact(String field) {
        return facts == null ? null : facts.get(field);
    }

    public boolean known(String field) {
        IntakeFact fact = fact(field);
        return fact != null && fact.sufficientlyKnown();
    }

    public boolean conflict(String field) {
        IntakeFact fact = fact(field);
        return fact != null && fact.state() == KnowledgeState.CONFLICT;
    }

    public boolean answered(String field) {
        IntakeFact fact = fact(field);
        return known(field) || (fact != null && fact.state() == KnowledgeState.UNKNOWN);
    }
}
