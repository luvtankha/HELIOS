package com.helios.patient.voice;

import org.springframework.data.jpa.repository.JpaRepository;

public interface VoiceSessionRepository extends JpaRepository<VoiceSessionEntity, String> {
    java.util.Optional<VoiceSessionEntity> findTopByPatientSessionIdOrderByCreatedAtDesc(String patientSessionId);
}
