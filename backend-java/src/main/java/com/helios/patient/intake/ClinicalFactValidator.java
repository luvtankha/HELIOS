package com.helios.patient.intake;

import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Component;

@Component
public class ClinicalFactValidator {

    private static final Set<String> ALLOWED_FIELDS = Set.of(
            "chiefComplaint",
            "onset",
            "duration",
            "severity",
            "location",
            "pattern",
            "character",
            "associatedSymptoms",
            "aggravatingRelievingFactors",
            "breathingDifficulty",
            "faintingOrSweating",
            "radiatingDiscomfort",
            "suddenSevereOnset",
            "neurologicalSymptoms",
            "severeAbdominalFeatures",
            "gastrointestinalSymptoms",
            "rashDistribution",
            "pastMedicalHistory",
            "pastSurgicalHistory",
            "currentMedications",
            "allergies",
            "familyHistory",
            "socialHistory");

    public IntakeFact validate(ClinicalFactCandidate candidate) {
        if (candidate == null || candidate.field() == null || !ALLOWED_FIELDS.contains(candidate.field())) {
            throw new IllegalArgumentException("AI candidate field is not allowed");
        }
        if (!"PATIENT_REPORTED".equals(candidate.source())) {
            throw new IllegalArgumentException("voice runtime may only propose patient-reported facts");
        }
        if (candidate.state() == null || candidate.confidence() == null
                || !Set.of("HIGH", "MEDIUM", "LOW").contains(candidate.confidence())) {
            throw new IllegalArgumentException("fact knowledge state and confidence are required");
        }
        if (candidate.value() != null && (candidate.value().length() > 4000
                || candidate.value().codePoints().anyMatch(code -> Character.UnicodeBlock.of(code) == Character.UnicodeBlock.DEVANAGARI))) {
            throw new IllegalArgumentException("clinical log values must use English or Roman Hinglish and be at most 4000 characters");
        }
        if (candidate.evidenceTurnIds() == null || candidate.evidenceTurnIds().isEmpty()
                || candidate.evidenceTurnIds().stream().anyMatch(id -> id == null || id.isBlank())) {
            throw new IllegalArgumentException("patient-reported fact requires turn evidence");
        }
        if (candidate.model() == null || candidate.model().isBlank()
                || candidate.conversationPolicyVersion() == null || candidate.conversationPolicyVersion().isBlank()) {
            throw new IllegalArgumentException("AI candidate requires model and policy provenance");
        }
        if (candidate.state() == KnowledgeState.KNOWN && (candidate.value() == null || candidate.value().isBlank())) {
            throw new IllegalArgumentException("known fact requires a value");
        }
        return new IntakeFact(
                candidate.field(),
                candidate.state(),
                candidate.value(),
                candidate.confidence(),
                List.copyOf(candidate.evidenceTurnIds()));
    }
}
