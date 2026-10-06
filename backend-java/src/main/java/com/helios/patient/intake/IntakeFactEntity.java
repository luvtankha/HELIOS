package com.helios.patient.intake;

import java.time.Instant;
import java.util.List;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;

@Entity
@Table(
        name = "HeliosIntakeFact",
        uniqueConstraints = @UniqueConstraint(
                name = "HeliosIntakeFact_patientSessionId_field_key",
                columnNames = {"patientSessionId", "field"}))
public class IntakeFactEntity {

    @Id
    @Column(name = "id", nullable = false)
    private String id;

    @Column(name = "patientSessionId", nullable = false)
    private String patientSessionId;

    @Column(name = "field", nullable = false, length = 96)
    private String field;

    @Column(name = "value", columnDefinition = "TEXT")
    private String value;

    @Enumerated(EnumType.STRING)
    @Column(name = "knowledgeState", nullable = false, length = 32)
    private KnowledgeState knowledgeState;

    @Column(name = "confidence", length = 32)
    private String confidence;

    @Column(name = "source", nullable = false, length = 48)
    private String source;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "evidenceTurnIds", nullable = false, columnDefinition = "jsonb")
    private List<String> evidenceTurnIds;

    @Column(name = "model", nullable = false)
    private String model;

    @Column(name = "modelVersion")
    private String modelVersion;

    @Column(name = "conversationPolicyVersion", nullable = false)
    private String conversationPolicyVersion;

    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "verificationStatus", nullable = false)
    private VerificationStatus verificationStatus = VerificationStatus.PATIENT_REPORTED;

    @Version
    @Column(name = "verificationVersion", nullable = false)
    private int verificationVersion;

    @Column(name = "createdAt", nullable = false)
    private Instant createdAt;

    @Column(name = "updatedAt", nullable = false)
    private Instant updatedAt;

    protected IntakeFactEntity() {}

    IntakeFactEntity(String id, String patientSessionId, ClinicalFactCandidate candidate) {
        this.id = id;
        this.patientSessionId = patientSessionId;
        apply(candidate);
    }

    void apply(ClinicalFactCandidate candidate) {
        boolean changed = !java.util.Objects.equals(value, candidate.value())
                || knowledgeState != candidate.state()
                || !java.util.Objects.equals(confidence, candidate.confidence())
                || !java.util.Objects.equals(evidenceTurnIds, candidate.evidenceTurnIds());
        if (!changed) return;
        if (verificationStatus != VerificationStatus.PATIENT_REPORTED
                && java.util.Objects.equals(evidenceTurnIds, candidate.evidenceTurnIds())) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.CONFLICT, "reviewed fact cannot be replaced by a stale model turn");
        }
        verificationStatus = VerificationStatus.PATIENT_REPORTED;
        this.field = candidate.field();
        this.value = candidate.value();
        this.knowledgeState = candidate.state();
        this.confidence = candidate.confidence();
        this.source = candidate.source();
        this.evidenceTurnIds = List.copyOf(candidate.evidenceTurnIds());
        this.model = candidate.model();
        this.modelVersion = candidate.modelVersion();
        this.conversationPolicyVersion = candidate.conversationPolicyVersion();
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

    IntakeFact toFact() {
        return new IntakeFact(field, knowledgeState, value, confidence, List.copyOf(evidenceTurnIds));
    }

    public String getId() { return id; }
    public String getPatientSessionId() { return patientSessionId; }
    public String getField() { return field; }
    public String getValue() { return value; }
    public KnowledgeState getKnowledgeState() { return knowledgeState; }
    public String getConfidence() { return confidence; }
    public String getSource() { return source; }
    public List<String> getEvidenceTurnIds() { return List.copyOf(evidenceTurnIds); }
    public String getModel() { return model; }
    public String getModelVersion() { return modelVersion; }
    public String getConversationPolicyVersion() { return conversationPolicyVersion; }
    public VerificationStatus getVerificationStatus() { return verificationStatus; }
    public int getVerificationVersion() { return verificationVersion; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
