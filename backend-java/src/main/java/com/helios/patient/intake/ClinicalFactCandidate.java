package com.helios.patient.intake;

import java.util.List;

public record ClinicalFactCandidate(
        String field,
        String value,
        KnowledgeState state,
        String confidence,
        String source,
        List<String> evidenceTurnIds,
        String model,
        String modelVersion,
        String conversationPolicyVersion) {}

