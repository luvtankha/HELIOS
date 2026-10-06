package com.helios.patient.routing;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class SpecializationRoutingEngine {

    private static final String LIMITATIONS = "Routing support, not a diagnosis. Match confidence is not a medical probability. "
            + "These draft rules cannot rule out an emergency; seek immediate help for severe or worsening symptoms.";
    private static final Pattern CLAUSE_SPLIT = Pattern.compile("[.;!?\\n]|\\bbut\\b|\\bhowever\\b|लेकिन", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern NEGATION = Pattern.compile("\\b(no|not|denies|denied|without|never)\\b");
    private static final Pattern HISTORIC = Pattern.compile("\\b(history of|years ago|last year|previous|resolved|used to|family history|my mother|my father)\\b");
    private static final Pattern HIGH_SEVERITY = Pattern.compile("\\b(severe|unbearable|[89]|10)\\b");

    private final RoutingDataset dataset;

    @Autowired
    public SpecializationRoutingEngine(RoutingDatasetLoader loader) {
        this.dataset = loader.dataset();
    }

    SpecializationRoutingEngine(RoutingDataset dataset) {
        this.dataset = dataset;
    }

    public RoutingResult route(RoutingInput input) {
        String current = join(
                input.complaint(),
                input.symptoms(),
                input.injury(),
                input.severity(),
                input.clinicalContext() == null ? null : input.clinicalContext().anatomicalLocation());
        String text = join(
                current,
                input.knownConditions(),
                input.duration(),
                input.clinicalContext() != null && input.clinicalContext().pregnant() ? "pregnant" : null);

        List<RoutingDataset.EmergencyRule> fired = dataset.emergencyRules().stream()
                .filter(rule -> rule.groups().stream().allMatch(group -> group.stream().anyMatch(term -> matches(current, term, true))))
                .toList();
        boolean existingEmergency = input.clinicalContext() != null && input.clinicalContext().currentEmergencySignal();
        if (existingEmergency || !fired.isEmpty()) {
            List<String> ruleIds = new ArrayList<>(fired.stream().map(RoutingDataset.EmergencyRule::id).toList());
            if (existingEmergency) ruleIds.add("existing-high-risk-signal");
            List<String> alternatives = fired.stream().anyMatch(rule -> "spinal-injury".equals(rule.id()))
                    ? List.of("trauma", "neurosurgery", "orthopaedics")
                    : List.of();
            return new RoutingResult(
                    "emergency-medicine", alternatives, 0.95, "high", "heuristic_match_not_probability",
                    "emergency", true, List.of(), List.of(), List.copyOf(ruleIds),
                    "Emergency medical evaluation recommended. Do not wait for a routine appointment. Contact local emergency services or the nearest emergency department now.",
                    LIMITATIONS, dataset.version());
        }

        List<Candidate> candidates = dataset.mappings().stream()
                .filter(RoutingDataset.Mapping::active)
                .filter(mapping -> ageMatches(mapping.ageGroup(), input.age()))
                .map(mapping -> candidate(mapping, input, text))
                .filter(candidate -> candidate != null)
                .sorted(Comparator.comparingInt(Candidate::score).reversed().thenComparing(candidate -> candidate.mapping().id()))
                .toList();

        Candidate best = candidates.isEmpty() ? null : candidates.getFirst();
        boolean ambiguous = best != null && candidates.size() > 1
                && candidates.get(1).score() == best.score()
                && !candidates.get(1).mapping().primarySpecialization().equals(best.mapping().primarySpecialization());
        boolean low = best == null || ambiguous || "general".equals(best.mapping().id());
        boolean pediatric = input.age() != null && input.age() < 18;

        String primary = low
                ? pediatric ? "pediatrics" : "internal-medicine"
                : best.mapping().primarySpecialization();

        Set<String> alternatives = new LinkedHashSet<>();
        candidates.stream().limit(3).forEach(candidate -> {
            alternatives.add(candidate.mapping().primarySpecialization());
            alternatives.addAll(candidate.mapping().secondarySpecializations());
        });
        if (pediatric && !"obstetrics-gynecology".equals(primary) && !"pediatric-surgery".equals(primary)) {
            alternatives.add(primary);
            primary = "pediatrics";
        }
        if ("nephrology".equals(primary) && matches(text, "diabetes")) alternatives.add("endocrinology");
        if (alternatives.isEmpty()) alternatives.add("family-medicine");
        alternatives.remove(primary);

        boolean severityHigh = HIGH_SEVERITY.matcher(input.severity() == null ? "" : input.severity().toLowerCase(Locale.ROOT)).find();
        String urgency = severityHigh || candidates.stream().anyMatch(candidate -> "urgent".equals(candidate.mapping().urgencyDefault()))
                ? "urgent"
                : best == null ? "soon" : best.mapping().urgencyDefault();

        List<String> matchedConditions = candidates.stream().limit(3).map(candidate -> candidate.mapping().id()).toList();
        LinkedHashSet<String> matchedSymptomsSet = new LinkedHashSet<>();
        candidates.stream().limit(3).forEach(candidate -> matchedSymptomsSet.addAll(candidate.signals()));
        List<String> matchedSymptoms = matchedSymptomsSet.stream().limit(12).toList();

        String reason = low
                ? "Recommended starting point: a general clinician can assess this broad or overlapping concern and arrange any further referral."
                : pediatric && "pediatrics".equals(primary)
                        ? "A child-focused clinician is the recommended starting point; relevant specialist services may also be needed."
                        : "Based on the reported concern, this department generally evaluates this type of problem. A clinician must confirm the appropriate referral.";

        return new RoutingResult(
                primary,
                alternatives.stream().limit(5).toList(),
                low ? 0.3 : best.known() ? 0.9 : 0.72,
                low ? "low" : best.known() ? "high" : "medium",
                "heuristic_match_not_probability",
                urgency,
                false,
                matchedConditions,
                matchedSymptoms,
                List.of(),
                reason,
                LIMITATIONS,
                dataset.version());
    }

    public static boolean matches(String text, String phrase) {
        return matches(text, phrase, false);
    }

    static boolean matches(String text, String phrase, boolean emergency) {
        if (text == null || phrase == null || text.isBlank() || phrase.isBlank()) return false;
        String[] needle = normalize(phrase).split(" ");
        for (String clause : CLAUSE_SPLIT.split(text.toLowerCase(Locale.ROOT))) {
            String normalizedClause = normalize(clause);
            if (normalizedClause.isBlank()) continue;
            String[] words = normalizedClause.split(" ");
            for (int start = 0; start <= words.length - needle.length; start++) {
                boolean allNear = true;
                for (int offset = 0; offset < needle.length; offset++) {
                    if (!near(words[start + offset], needle[offset])) {
                        allNear = false;
                        break;
                    }
                }
                if (!allNear) continue;
                String before = String.join(" ", slice(words, Math.max(0, start - 5), start));
                String after = String.join(" ", slice(words, start + needle.length, Math.min(words.length, start + needle.length + 3)));
                if (NEGATION.matcher(before).find() || after.matches("^(absent|denied|नहीं)(\\s.*)?$")) continue;
                if (emergency && HISTORIC.matcher(clause).find()) continue;
                return true;
            }
        }
        return false;
    }

    static String normalize(String value) {
        return Normalizer.normalize(value.toLowerCase(Locale.ROOT), Normalizer.Form.NFKC)
                .replaceAll("[’']", "")
                .replaceAll("[^\\p{L}\\p{N}\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private Candidate candidate(RoutingDataset.Mapping mapping, RoutingInput input, String text) {
        List<String> aliases = mapping.aliases().stream().filter(term -> matches(text, term)).toList();
        LinkedHashSet<String> signalSet = new LinkedHashSet<>();
        mapping.symptomKeywords().stream().filter(term -> matches(text, term)).forEach(signalSet::add);
        mapping.injuryKeywords().stream().filter(term -> matches(text, term)).forEach(signalSet::add);
        List<String> signals = List.copyOf(signalSet);
        boolean groups = !mapping.requiredGroups().isEmpty()
                && mapping.requiredGroups().stream().allMatch(group -> group.stream().anyMatch(term -> matches(text, term)));
        if (aliases.isEmpty() && !(groups && signals.size() >= mapping.minSignals())) return null;
        boolean known = safe(input.knownConditions()).stream()
                .anyMatch(condition -> mapping.aliases().stream().anyMatch(term -> matches(condition, term)));
        int score = (known ? 12 : !aliases.isEmpty() ? 8 : 6) + Math.min(3, signals.size()) + mapping.priority();
        List<String> allSignals = new ArrayList<>(aliases);
        allSignals.addAll(signals);
        return new Candidate(mapping, score, List.copyOf(allSignals), known);
    }

    private static boolean ageMatches(String ageGroup, Integer age) {
        if ("child".equals(ageGroup)) return age != null && age < 18;
        if ("adult".equals(ageGroup)) return age == null || age >= 18;
        return true;
    }

    private static String join(Object... values) {
        List<String> parts = new ArrayList<>();
        for (Object value : values) {
            if (value instanceof String string && !string.isBlank()) parts.add(string);
            else if (value instanceof List<?> list) list.stream().filter(String.class::isInstance).map(String.class::cast).filter(s -> !s.isBlank()).forEach(parts::add);
        }
        return String.join(". ", parts);
    }

    private static List<String> safe(List<String> values) {
        return values == null ? List.of() : values;
    }

    private static String singular(String word) {
        if (word.length() > 5 && word.endsWith("es")) return word.substring(0, word.length() - 2);
        if (word.length() > 4 && word.endsWith("s")) return word.substring(0, word.length() - 1);
        return word;
    }

    private static boolean near(String a, String b) {
        if (a.equals(b) || singular(a).equals(singular(b))) return true;
        if (a.length() < 6 || b.length() < 6 || Math.abs(a.length() - b.length()) > 1) return false;
        int edits = 0;
        int i = 0;
        int j = 0;
        while (i < a.length() && j < b.length()) {
            if (a.charAt(i) == b.charAt(j)) {
                i++;
                j++;
                continue;
            }
            if (++edits > 1) return false;
            if (a.length() >= b.length()) i++;
            if (b.length() >= a.length()) j++;
        }
        return edits + ((i < a.length() || j < b.length()) ? 1 : 0) <= 1;
    }

    private static List<String> slice(String[] values, int from, int to) {
        List<String> result = new ArrayList<>();
        for (int index = from; index < to; index++) result.add(values[index]);
        return result;
    }

    private record Candidate(RoutingDataset.Mapping mapping, int score, List<String> signals, boolean known) {}
}
