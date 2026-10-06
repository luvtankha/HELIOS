package com.helios.patient.common.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.Test;

class ApiMetaControllerTest {

    @Test
    void exposesLockedPatientLanguageAndClinicalAuthority() {
        var controller = new ApiMetaController("v2", "hi-Hinglish");

        Map<String, Object> metadata = controller.metadata();

        assertThat(metadata)
                .containsEntry("service", "helios-patient-api")
                .containsEntry("apiVersion", "v2")
                .containsEntry("conversationLanguage", "hi-Hinglish")
                .containsEntry("clinicalAuthority", "clinician");
    }
}
