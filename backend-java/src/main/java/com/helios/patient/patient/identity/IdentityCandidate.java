package com.helios.patient.patient.identity;

import java.util.List;

public record IdentityCandidate(
        String field,
        String value,
        String confidence,
        String source,
        List<String> evidenceTurnIds,
        String model,
        String modelVersion,
        String conversationPolicyVersion) {}
