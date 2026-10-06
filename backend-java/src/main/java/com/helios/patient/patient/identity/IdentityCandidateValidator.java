package com.helios.patient.patient.identity;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

import org.springframework.stereotype.Component;

import com.helios.patient.patient.PatientSex;

@Component
public class IdentityCandidateValidator {

    private static final Set<String> ALLOWED_FIELDS =
            Set.of("fullName", "age", "sex", "phone");
    private static final Pattern NAME = Pattern.compile(
            "^[\\p{L}][\\p{L}\\p{M} .'-]{0,98}[\\p{L}\\p{M}.']$",
            Pattern.UNICODE_CHARACTER_CLASS);
    private static final Pattern PHONE = Pattern.compile("^\\+?[0-9][0-9 -]{6,18}$");

    public ValidatedIdentityField validate(IdentityCandidate candidate) {
        if (candidate == null || candidate.field() == null || !ALLOWED_FIELDS.contains(candidate.field())) {
            throw new IllegalArgumentException("identity candidate field is not allowed");
        }
        if (!"PATIENT_REPORTED".equals(candidate.source())) {
            throw new IllegalArgumentException("identity source must be patient-reported");
        }
        if (candidate.confidence() == null || !Set.of("HIGH", "MEDIUM", "LOW").contains(candidate.confidence())) {
            throw new IllegalArgumentException("identity confidence is invalid");
        }
        if (candidate.evidenceTurnIds() == null
                || candidate.evidenceTurnIds().isEmpty()
                || candidate.evidenceTurnIds().stream().anyMatch(id -> id == null || id.isBlank())) {
            throw new IllegalArgumentException("identity candidate requires turn evidence");
        }
        if (candidate.model() == null || candidate.model().isBlank()
                || candidate.conversationPolicyVersion() == null
                || candidate.conversationPolicyVersion().isBlank()) {
            throw new IllegalArgumentException("identity candidate requires model and policy provenance");
        }
        String value = candidate.value() == null ? "" : candidate.value().trim();
        String normalized = switch (candidate.field()) {
            case "fullName" -> normalizeName(value);
            case "age" -> normalizeAge(value);
            case "sex" -> normalizeSex(value).name();
            case "phone" -> normalizePhone(value);
            default -> throw new IllegalArgumentException("identity candidate field is not allowed");
        };
        return new ValidatedIdentityField(
                candidate.field(),
                normalized,
                candidate.confidence(),
                List.copyOf(candidate.evidenceTurnIds()),
                candidate.model(),
                candidate.modelVersion(),
                candidate.conversationPolicyVersion());
    }

    private static String normalizeName(String value) {
        String normalized = value.replaceAll("\\s+", " ").trim();
        if (normalized.length() < 2 || normalized.length() > 100 || !NAME.matcher(normalized).matches()) {
            throw new IllegalArgumentException("full name is invalid");
        }
        return normalized;
    }

    private static String normalizeAge(String value) {
        if (!value.matches("(?i)[0-9]{1,3}(?:\\s+years(?:\\s+old)?)?")) throw new IllegalArgumentException("age must be normalized to a whole number");
        try {
            int age = Integer.parseInt(value.split("\\s+")[0]);
            if (age < 0 || age > 120) throw new IllegalArgumentException("age is outside allowed range");
            return Integer.toString(age);
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException("age must be normalized to a number", exception);
        }
    }

    private static PatientSex normalizeSex(String value) {
        String normalized = value.toLowerCase(Locale.ROOT).replace('-', '_').trim();
        return switch (normalized) {
            case "male", "man", "m", "पुरुष", "aadmi", "आदमी" -> PatientSex.MALE;
            case "female", "woman", "f", "महिला", "aurat", "औरत" -> PatientSex.FEMALE;
            case "other", "अन्य" -> PatientSex.OTHER;
            case "prefer_not_to_say", "prefer not to say", "नहीं बताना", "skip" ->
                    PatientSex.PREFER_NOT_TO_SAY;
            default -> throw new IllegalArgumentException("sex value is not recognized");
        };
    }

    private static String normalizePhone(String value) {
        if (value.isBlank()) return "";
        if (!PHONE.matcher(value).matches()) {
            throw new IllegalArgumentException("phone value is invalid");
        }
        String digits = value.replaceAll("[^0-9]", "");
        if (digits.length() < 7 || digits.length() > 15) {
            throw new IllegalArgumentException("phone value is invalid");
        }
        return value.startsWith("+") ? "+" + digits : digits;
    }

    public record ValidatedIdentityField(
            String field,
            String value,
            String confidence,
            List<String> evidenceTurnIds,
            String model,
            String modelVersion,
            String conversationPolicyVersion) {}
}
