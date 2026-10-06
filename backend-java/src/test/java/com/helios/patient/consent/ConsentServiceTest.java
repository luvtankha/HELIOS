package com.helios.patient.consent;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.Test;

import com.helios.patient.common.id.CuidGenerator;
import com.helios.patient.patient.session.PatientSessionResponse;
import com.helios.patient.patient.session.PatientSessionService;

class ConsentServiceTest {

    @Test
    void recordsConsentAndAdvancesAuthorizedPatientSession() {
        ConsentRecordRepository repository = mock(ConsentRecordRepository.class);
        PatientSessionService patientSessions = mock(PatientSessionService.class);
        when(patientSessions.getForUpdate(anyString(), anyString())).thenReturn(new PatientSessionResponse(
                "session-1", null, "STARTED", "CONSENT", "hi-Hinglish", null, null, null));
        when(repository.findBySessionIdAndConsentTypeAndVersion(anyString(), anyString(), anyString()))
                .thenReturn(Optional.empty());
        when(repository.save(any(ConsentRecordEntity.class))).thenAnswer(invocation -> {
            ConsentRecordEntity entity = invocation.getArgument(0);
            entity.onCreate();
            return entity;
        });
        ConsentService service = new ConsentService(repository, patientSessions, new CuidGenerator());

        var response = service.record("session-1", "AI_INTAKE", true, "v2", "proof");

        assertThat(response.accepted()).isTrue();
        assertThat(response.acceptedAt()).isNotNull();
        verify(patientSessions).recordConsent("session-1", "proof", true);
    }
}
