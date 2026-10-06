package com.helios.patient.intake;

import java.util.List;

public record IntakeFact(
        String field,
        KnowledgeState state,
        String value,
        String confidence,
        List<String> evidenceTurnIds) {

    public boolean sufficientlyKnown() {
        return state == KnowledgeState.KNOWN && value != null && !value.isBlank();
    }
}

