package com.helios.patient.patient.session;

import java.util.Optional;

import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

public interface PatientSessionRepository extends JpaRepository<PatientSessionEntity, String> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select session from PatientSessionEntity session where session.id = :id")
    Optional<PatientSessionEntity> findByIdForUpdate(@Param("id") String id);
}
