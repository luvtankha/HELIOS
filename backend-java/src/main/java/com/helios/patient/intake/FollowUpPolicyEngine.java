package com.helios.patient.intake;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import org.springframework.stereotype.Component;

/**
 * Deterministic authority boundary for follow-up selection.
 *
 * The voice model may realize an intent naturally in Hindi/Hinglish, but it
 * cannot bypass required safety/clarification intents or invent completion.
 */
@Component
public class FollowUpPolicyEngine {

    private static final List<String> CORE_FIELDS =
            List.of("chiefComplaint", "onset", "severity", "pattern", "associatedSymptoms");

    public FollowUpDecision next(IntakeSnapshot snapshot) {
        List<String> conflicts = snapshot.facts() == null
                ? List.of()
                : snapshot.facts().values().stream()
                        .filter(fact -> fact.state() == KnowledgeState.CONFLICT)
                        .map(IntakeFact::field)
                        .sorted()
                        .toList();
        if (!conflicts.isEmpty()) {
            String field = conflicts.getFirst();
            return FollowUpDecision.ask(
                    intent("clarify-" + field, field, "Clarify conflicting patient-reported information", FollowUpIntent.Priority.CLARIFICATION, true),
                    "A conflicting fact must be clarified before completion.");
        }

        String complaint = normalizedComplaint(snapshot);
        for (FollowUpIntent safetyIntent : symptomSpecificSafetyIntents(complaint)) {
            if (!snapshot.answered(safetyIntent.targetField())) {
                return FollowUpDecision.ask(safetyIntent, "A symptom-specific safety field is still missing.");
            }
        }

        for (String field : CORE_FIELDS) {
            if (!("chiefComplaint".equals(field) ? snapshot.known(field) : snapshot.answered(field))) {
                return FollowUpDecision.ask(
                        intent("collect-" + field, field, purpose(field), FollowUpIntent.Priority.CLINICAL_CONTEXT, true),
                        "A core intake field is still missing.");
            }
        }

        for (FollowUpIntent contextual : symptomSpecificContextIntents(complaint)) {
            if (!snapshot.answered(contextual.targetField())) {
                return FollowUpDecision.ask(contextual, "A symptom-specific context field would materially improve the clinical brief.");
            }
        }

        return FollowUpDecision.complete("Required safety, clarification, core and symptom-specific intake fields are sufficiently covered.");
    }

    /**
     * Validates a model-proposed semantic intent. The model may rank/word an
     * allowed intent, but cannot introduce diagnosis/treatment/prescribing.
     */
    public boolean allowsModelIntent(IntakeSnapshot snapshot, FollowUpIntent proposed) {
        if (proposed == null || proposed.id() == null || proposed.targetField() == null) return false;
        String id = proposed.id().toLowerCase(Locale.ROOT);
        String purpose = proposed.purpose() == null ? "" : proposed.purpose().toLowerCase(Locale.ROOT);
        if (id.contains("diagnos") || id.contains("prescrib") || id.contains("treatment")
                || purpose.contains("diagnos") || purpose.contains("prescrib") || purpose.contains("treatment recommendation")) {
            return false;
        }
        if (snapshot.known(proposed.targetField()) && !snapshot.conflict(proposed.targetField())) return false;

        FollowUpDecision authoritative = next(snapshot);
        if (authoritative.complete()) return false;
        if (authoritative.nextIntent().priority() == FollowUpIntent.Priority.SAFETY
                || authoritative.nextIntent().priority() == FollowUpIntent.Priority.CLARIFICATION) {
            return authoritative.nextIntent().targetField().equals(proposed.targetField());
        }
        return proposed.priority() != FollowUpIntent.Priority.OPTIONAL || snapshot.completedTurns() < 12;
    }

    private static List<FollowUpIntent> symptomSpecificSafetyIntents(String complaint) {
        List<FollowUpIntent> intents = new ArrayList<>();
        if (containsAny(complaint, "chest", "सीने", "pressure", "दबाव", "seene", "seena", "chhati", "chaati")) {
            intents.add(intent("chest-breathing", "breathingDifficulty", "Check whether chest symptoms are accompanied by breathing difficulty", FollowUpIntent.Priority.SAFETY, true));
            intents.add(intent("chest-fainting", "faintingOrSweating", "Check for fainting or sweating reported with chest symptoms", FollowUpIntent.Priority.SAFETY, true));
            intents.add(intent("chest-radiation", "radiatingDiscomfort", "Check whether chest discomfort is reported in the arm, jaw, back or shoulder", FollowUpIntent.Priority.SAFETY, true));
        } else if (containsAny(complaint, "headache", "सिर", "migraine", "sir dard", "sar dard", "sir mein", "sir me")) {
            intents.add(intent("headache-sudden", "suddenSevereOnset", "Clarify whether the headache started suddenly and severely", FollowUpIntent.Priority.SAFETY, true));
            intents.add(intent("headache-neuro", "neurologicalSymptoms", "Check for patient-reported weakness, speech or vision change", FollowUpIntent.Priority.SAFETY, true));
        } else if (containsAny(complaint, "abdominal", "stomach", "pet dard", "pet mein", "pet me", "pet pain", "पेट")) {
            intents.add(intent("abdomen-severe", "severeAbdominalFeatures", "Check for severe worsening pain, fainting or heavy bleeding", FollowUpIntent.Priority.SAFETY, true));
        }
        return intents;
    }

    private static List<FollowUpIntent> symptomSpecificContextIntents(String complaint) {
        if (containsAny(complaint, "chest", "सीने", "pressure", "दबाव", "seene", "seena", "chhati", "chaati")) {
            return List.of(intent("chest-trigger", "aggravatingRelievingFactors", "Clarify activity/rest or other factors that change the chest discomfort", FollowUpIntent.Priority.CLINICAL_CONTEXT, false));
        }
        if (containsAny(complaint, "abdominal", "stomach", "pet dard", "pet mein", "pet me", "pet pain", "पेट")) {
            return List.of(
                    intent("abdomen-location", "location", "Clarify where the abdominal symptom is felt", FollowUpIntent.Priority.CLINICAL_CONTEXT, true),
                    intent("abdomen-gi", "gastrointestinalSymptoms", "Clarify associated vomiting or bowel changes", FollowUpIntent.Priority.CLINICAL_CONTEXT, false));
        }
        if (containsAny(complaint, "rash", "skin", "खुजली", "khujli")) {
            return List.of(intent("skin-spread", "rashDistribution", "Clarify where the skin change is and whether it is spreading", FollowUpIntent.Priority.CLINICAL_CONTEXT, false));
        }
        if (containsAny(complaint, "cough", "khansi", "खांसी", "fever", "bukhar", "बुखार", "breath", "saans", "सांस")) {
            return List.of(
                    intent("respiratory-breathing", "breathingDifficulty", "Clarify breathing difficulty with the respiratory concern", FollowUpIntent.Priority.CLINICAL_CONTEXT, true),
                    intent("respiratory-character", "character", "Clarify cough type, measured temperature or breathing pattern relevant to the reported concern", FollowUpIntent.Priority.CLINICAL_CONTEXT, false));
        }
        if (containsAny(complaint, "back", "joint", "knee", "पीठ", "घुटने", "kamar")) {
            return List.of(
                    intent("pain-location", "location", "Clarify which joint or part of the back is affected", FollowUpIntent.Priority.CLINICAL_CONTEXT, true),
                    intent("pain-trigger", "aggravatingRelievingFactors", "Clarify movement or activity that changes the reported pain", FollowUpIntent.Priority.CLINICAL_CONTEXT, false));
        }
        return List.of();
    }

    private static FollowUpIntent intent(String id, String field, String purpose, FollowUpIntent.Priority priority, boolean required) {
        return new FollowUpIntent(id, field, purpose, priority, required);
    }

    private static String normalizedComplaint(IntakeSnapshot snapshot) {
        StringBuilder value = new StringBuilder(snapshot.chiefComplaint() == null ? "" : snapshot.chiefComplaint());
        if (snapshot.symptomTerms() != null) snapshot.symptomTerms().forEach(term -> value.append(' ').append(term));
        return value.toString().toLowerCase(Locale.ROOT);
    }

    private static boolean containsAny(String value, String... terms) {
        for (String term : terms) if (value.contains(term.toLowerCase(Locale.ROOT))) return true;
        return false;
    }

    private static String purpose(String field) {
        return switch (field) {
            case "onset" -> "Clarify when the current concern began";
            case "chiefComplaint" -> "Clarify the patient's main reason for today's consultation";
            case "severity" -> "Clarify patient-reported severity without interpreting it diagnostically";
            case "pattern" -> "Clarify whether the symptom is constant, intermittent or changing";
            case "associatedSymptoms" -> "Clarify other symptoms occurring with the main concern";
            default -> "Clarify missing intake context";
        };
    }
}
