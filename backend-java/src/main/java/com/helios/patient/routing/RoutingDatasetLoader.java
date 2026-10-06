package com.helios.patient.routing;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Component
public class RoutingDatasetLoader {

    private final RoutingDataset dataset;

    public RoutingDatasetLoader(JsonMapper jsonMapper) {
        this.dataset = load(jsonMapper);
    }

    public RoutingDataset dataset() {
        return dataset;
    }

    private static RoutingDataset load(JsonMapper mapper) {
        var resource = new ClassPathResource("routing/specialization-routing.json");
        try (var input = resource.getInputStream()) {
            JsonNode root = mapper.readTree(input);
            String version = text(root, "version");
            if (!"CLINICIAN_REVIEW_REQUIRED".equals(text(root, "reviewStatus"))) {
                throw new IllegalStateException("routing dataset must require clinician review");
            }
            List<RoutingDataset.Mapping> mappings = new ArrayList<>();
            for (JsonNode node : root.get("mappings")) {
                mappings.add(new RoutingDataset.Mapping(
                        text(node, "id"),
                        strings(node.get("aliases")),
                        strings(node.get("symptomKeywords")),
                        strings(node.get("injuryKeywords")),
                        text(node, "primarySpecialization"),
                        strings(node.get("secondarySpecializations")),
                        text(node, "urgencyDefault"),
                        text(node, "ageGroup"),
                        node.get("active").booleanValue(),
                        stringGroups(node.get("requiredGroups")),
                        node.get("minSignals").intValue(),
                        node.get("priority").intValue()));
            }
            List<RoutingDataset.EmergencyRule> rules = new ArrayList<>();
            for (JsonNode node : root.get("emergencyRules")) {
                rules.add(new RoutingDataset.EmergencyRule(text(node, "id"), stringGroups(node.get("groups"))));
            }
            if (version.isBlank() || mappings.isEmpty() || rules.isEmpty()) {
                throw new IllegalStateException("routing dataset is incomplete");
            }
            return new RoutingDataset(version, List.copyOf(mappings), List.copyOf(rules));
        } catch (IOException exception) {
            throw new IllegalStateException("could not load routing dataset", exception);
        }
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null ? "" : value.stringValue();
    }

    private static List<String> strings(JsonNode node) {
        if (node == null || !node.isArray()) return List.of();
        List<String> values = new ArrayList<>();
        for (JsonNode value : node) values.add(value.stringValue());
        return List.copyOf(values);
    }

    private static List<List<String>> stringGroups(JsonNode node) {
        if (node == null || !node.isArray()) return List.of();
        List<List<String>> groups = new ArrayList<>();
        for (JsonNode group : node) groups.add(strings(group));
        return List.copyOf(groups);
    }
}

