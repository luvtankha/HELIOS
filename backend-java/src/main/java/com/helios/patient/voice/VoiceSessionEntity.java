package com.helios.patient.voice;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "HeliosVoiceSession")
public class VoiceSessionEntity {

    @Id
    @Column(name = "id", nullable = false)
    private String id;

    @Column(name = "patientSessionId", nullable = false)
    private String patientSessionId;

    @Column(name = "visitId")
    private String visitId;

    @Enumerated(EnumType.STRING)
    @Column(name = "state", nullable = false, length = 32)
    private VoiceSessionState state;

    @Column(name = "doctorAvatarId", nullable = false)
    private String doctorAvatarId;

    @Column(name = "lastAcknowledgedSequence", nullable = false)
    private long lastAcknowledgedSequence;

    @Column(name = "createdAt", nullable = false)
    private Instant createdAt;

    @Column(name = "updatedAt", nullable = false)
    private Instant updatedAt;

    protected VoiceSessionEntity() {}

    VoiceSessionEntity(
            String id,
            String patientSessionId,
            String visitId,
            VoiceSessionState state,
            String doctorAvatarId,
            long lastAcknowledgedSequence,
            Instant createdAt) {
        this.id = id;
        this.patientSessionId = patientSessionId;
        this.visitId = visitId;
        this.state = state;
        this.doctorAvatarId = doctorAvatarId;
        this.lastAcknowledgedSequence = lastAcknowledgedSequence;
        this.createdAt = createdAt;
        this.updatedAt = createdAt;
    }

    void acknowledge(long sequence) {
        this.lastAcknowledgedSequence = sequence;
    }

    void transitionTo(VoiceSessionState nextState) {
        this.state = nextState;
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public String getId() { return id; }
    public String getPatientSessionId() { return patientSessionId; }
    public String getVisitId() { return visitId; }
    public VoiceSessionState getState() { return state; }
    public String getDoctorAvatarId() { return doctorAvatarId; }
    public long getLastAcknowledgedSequence() { return lastAcknowledgedSequence; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
