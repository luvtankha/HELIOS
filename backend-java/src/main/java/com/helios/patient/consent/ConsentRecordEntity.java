package com.helios.patient.consent;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "ConsentRecord")
public class ConsentRecordEntity {
    @Id
    private String id;
    @Column(name = "patientId")
    private String patientId;
    @Column(name = "sessionId", nullable = false)
    private String sessionId;
    @Column(name = "consentType", nullable = false)
    private String consentType;
    @Column(name = "accepted", nullable = false)
    private boolean accepted;
    @Column(name = "version", nullable = false)
    private String version;
    @Column(name = "acceptedAt", nullable = false)
    private LocalDateTime acceptedAt;
    @Column(name = "withdrawnAt")
    private LocalDateTime withdrawnAt;

    protected ConsentRecordEntity() {}

    public ConsentRecordEntity(String id, String sessionId, String consentType, boolean accepted, String version) {
        this.id = id;
        this.sessionId = sessionId;
        this.consentType = consentType;
        this.accepted = accepted;
        this.version = version;
    }

    @PrePersist
    void onCreate() {
        if (acceptedAt == null) acceptedAt = LocalDateTime.now();
    }

    public String getId() { return id; }
    public String getSessionId() { return sessionId; }
    public String getConsentType() { return consentType; }
    public boolean isAccepted() { return accepted; }
    public String getVersion() { return version; }
    public LocalDateTime getAcceptedAt() { return acceptedAt; }
}

