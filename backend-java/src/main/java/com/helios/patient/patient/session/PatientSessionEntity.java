package com.helios.patient.patient.session;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "PatientSession")
public class PatientSessionEntity {

    @Id
    @Column(name = "id", nullable = false)
    private String id;

    @Column(name = "patientId")
    private String patientId;

    @Column(name = "visitId")
    private String visitId;

    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false)
    private PatientSessionStatus status;

    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "currentStep", nullable = false)
    private PatientFlowStep currentStep;

    @Column(name = "language", nullable = false)
    private String language;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "draftData", columnDefinition = "jsonb")
    private Map<String, String> draftData;

    @Column(name = "startedAt", nullable = false)
    private LocalDateTime startedAt;

    @Column(name = "completedAt")
    private LocalDateTime completedAt;

    @Column(name = "lastActiveAt", nullable = false)
    private LocalDateTime lastActiveAt;

    @Column(name = "createdAt", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updatedAt", nullable = false)
    private LocalDateTime updatedAt;

    protected PatientSessionEntity() {}

    private PatientSessionEntity(String id, String language) {
        this.id = id;
        this.language = language;
        this.status = PatientSessionStatus.STARTED;
        // v2 has no visible language-selection screen; consent is the first persisted gate.
        this.currentStep = PatientFlowStep.CONSENT;
    }

    public static PatientSessionEntity create(String id, String language) {
        return new PatientSessionEntity(id, language);
    }

    public void recordConsent(boolean accepted) {
        if (!accepted) return;
        if (currentStep == PatientFlowStep.CONSENT) {
            currentStep = PatientFlowStep.BASIC_INFO;
            status = PatientSessionStatus.IN_PROGRESS;
        }
    }

    public void recordIdentityField(String field, String value) {
        Map<String, String> next = new LinkedHashMap<>(
                draftData == null ? Map.of() : draftData);
        next.put("identity." + field, value);
        draftData = next;
        if (currentStep == PatientFlowStep.CONSENT) {
            currentStep = PatientFlowStep.BASIC_INFO;
            status = PatientSessionStatus.IN_PROGRESS;
        }
    }

    public String identityValue(String field) {
        return draftData == null ? null : draftData.get("identity." + field);
    }

    public boolean hasRequiredIdentity() {
        return nonBlank(identityValue("fullName"))
                && nonBlank(identityValue("age"))
                && nonBlank(identityValue("sex"));
    }

    public void linkPatientVisit(String patientId, String visitId) {
        if (this.patientId != null || this.visitId != null) {
            if (!java.util.Objects.equals(this.patientId, patientId)
                    || !java.util.Objects.equals(this.visitId, visitId)) {
                throw new IllegalStateException("patient session is already linked");
            }
            return;
        }
        this.patientId = patientId;
        this.visitId = visitId;
        this.currentStep = PatientFlowStep.CHIEF_COMPLAINT;
        this.status = PatientSessionStatus.IN_PROGRESS;
    }

    public void beginInterview() {
        if (currentStep == PatientFlowStep.CHIEF_COMPLAINT
                || currentStep == PatientFlowStep.BASIC_INFO) {
            currentStep = PatientFlowStep.INTERVIEW;
        }
    }

    public void readyForReview() {
        currentStep = PatientFlowStep.REVIEW;
        status = PatientSessionStatus.READY_FOR_REVIEW;
    }

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (startedAt == null) startedAt = now;
        if (lastActiveAt == null) lastActiveAt = now;
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
        lastActiveAt = updatedAt;
    }

    public String getId() { return id; }
    public String getPatientId() { return patientId; }
    public String getVisitId() { return visitId; }
    public PatientSessionStatus getStatus() { return status; }
    public PatientFlowStep getCurrentStep() { return currentStep; }
    public String getLanguage() { return language; }
    public Map<String, String> getDraftData() {
        return draftData == null ? Map.of() : Map.copyOf(draftData);
    }
    public LocalDateTime getStartedAt() { return startedAt; }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public LocalDateTime getLastActiveAt() { return lastActiveAt; }

    private static boolean nonBlank(String value) {
        return value != null && !value.isBlank();
    }
}
