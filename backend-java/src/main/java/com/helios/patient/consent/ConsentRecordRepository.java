package com.helios.patient.consent;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ConsentRecordRepository extends JpaRepository<ConsentRecordEntity, String> {
    Optional<ConsentRecordEntity> findBySessionIdAndConsentTypeAndVersion(
            String sessionId, String consentType, String version);
}
