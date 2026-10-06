package com.helios.patient.intake;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface IntakeFactRepository extends JpaRepository<IntakeFactEntity, String> {
    Optional<IntakeFactEntity> findByPatientSessionIdAndField(String patientSessionId, String field);
    List<IntakeFactEntity> findByPatientSessionIdOrderByUpdatedAtAsc(String patientSessionId);
}
