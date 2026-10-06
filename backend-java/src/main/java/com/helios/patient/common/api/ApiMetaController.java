package com.helios.patient.common.api;

import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v2/meta")
public class ApiMetaController {

    private final String apiVersion;
    private final String languageMode;

    public ApiMetaController(
            @Value("${helios.api.version:v2}") String apiVersion,
            @Value("${helios.voice.language-mode:hi-Hinglish}") String languageMode) {
        this.apiVersion = apiVersion;
        this.languageMode = languageMode;
    }

    @GetMapping
    public Map<String, Object> metadata() {
        return Map.of(
                "service", "helios-patient-api",
                "apiVersion", apiVersion,
                "conversationLanguage", languageMode,
                "clinicalAuthority", "clinician");
    }
}

