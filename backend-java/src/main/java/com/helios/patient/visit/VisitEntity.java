package com.helios.patient.visit;

import java.time.LocalDateTime;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "Visit")
public class VisitEntity {

    @Id
    @Column(name = "id", nullable = false)
    private String id;

    @Column(name = "patientId", nullable = false)
    private String patientId;

    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false)
    private VisitStatus status;

    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "visitType", nullable = false)
    private VisitType visitType;

    @Column(name = "preferredDoctorId")
    private String preferredDoctorId;

    @Column(name = "startedAt", nullable = false)
    private LocalDateTime startedAt;

    @Column(name = "completedAt")
    private LocalDateTime completedAt;

    @Column(name = "createdAt", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updatedAt", nullable = false)
    private LocalDateTime updatedAt;

    protected VisitEntity() {}

    public VisitEntity(String id, String patientId) {
        this.id = id;
        this.patientId = patientId;
        this.status = VisitStatus.WAITING;
        this.visitType = VisitType.PRE_CONSULTATION;
    }

    public void readyForDoctor() {
        if (status != VisitStatus.COMPLETED && status != VisitStatus.CANCELLED) {
            status = VisitStatus.READY_FOR_DOCTOR;
        }
    }

    public void assignPreferredDoctor(String doctorId) {
        this.preferredDoctorId = doctorId;
    }

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (startedAt == null) startedAt = now;
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public String getId() { return id; }
    public String getPatientId() { return patientId; }
    public VisitStatus getStatus() { return status; }
    public VisitType getVisitType() { return visitType; }
    public String getPreferredDoctorId() { return preferredDoctorId; }
}
