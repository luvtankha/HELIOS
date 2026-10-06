package com.helios.patient.patient;

import java.time.LocalDateTime;

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

@Entity
@Table(name = "PatientProfile")
public class PatientProfileEntity {

    @Id
    @Column(name = "id", nullable = false)
    private String id;

    @Column(name = "patientCode", nullable = false, unique = true)
    private String patientCode;

    @Column(name = "fullName", nullable = false)
    private String fullName;

    @Column(name = "age", nullable = false)
    private int age;

    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Enumerated(EnumType.STRING)
    @Column(name = "sex", nullable = false)
    private PatientSex sex;

    @Column(name = "preferredLanguage", nullable = false)
    private String preferredLanguage;

    @Column(name = "phone")
    private String phone;

    @Column(name = "createdAt", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updatedAt", nullable = false)
    private LocalDateTime updatedAt;

    protected PatientProfileEntity() {}

    public PatientProfileEntity(
            String id,
            String patientCode,
            String fullName,
            int age,
            PatientSex sex,
            String preferredLanguage,
            String phone) {
        this.id = id;
        this.patientCode = patientCode;
        this.fullName = fullName;
        this.age = age;
        this.sex = sex;
        this.preferredLanguage = preferredLanguage;
        this.phone = phone;
    }

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public String getId() { return id; }
    public String getPatientCode() { return patientCode; }
    public String getFullName() { return fullName; }
    public int getAge() { return age; }
    public PatientSex getSex() { return sex; }
    public String getPreferredLanguage() { return preferredLanguage; }
    public String getPhone() { return phone; }
}
