package com.helios.patient.intake;

public record FollowUpIntent(
        String id,
        String targetField,
        String purpose,
        Priority priority,
        boolean requiredForCompletion) {

    public enum Priority {
        SAFETY,
        CLARIFICATION,
        CLINICAL_CONTEXT,
        OPTIONAL
    }
}

