package com.helios.patient.patient.session;

import java.time.LocalDateTime;

public record PatientSessionResponse(
        String sessionId,
        String sessionToken,
        String status,
        String currentStep,
        String conversationLanguage,
        String patientId,
        String visitId,
        LocalDateTime startedAt) {

    static PatientSessionResponse from(PatientSessionEntity entity, String token) {
        return new PatientSessionResponse(
                entity.getId(),
                token,
                entity.getStatus().name(),
                entity.getCurrentStep().name(),
                entity.getLanguage(),
                entity.getPatientId(),
                entity.getVisitId(),
                entity.getStartedAt());
    }
}

