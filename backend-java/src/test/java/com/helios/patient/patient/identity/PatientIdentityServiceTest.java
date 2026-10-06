package com.helios.patient.patient.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import com.helios.patient.common.id.CuidGenerator;
import com.helios.patient.patient.PatientProfileEntity;
import com.helios.patient.patient.PatientProfileRepository;
import com.helios.patient.patient.session.PatientSessionEntity;
import com.helios.patient.patient.session.PatientSessionRepository;
import com.helios.patient.visit.VisitEntity;
import com.helios.patient.visit.VisitRepository;

class PatientIdentityServiceTest {

    @Test
    void refusesIdentityBeforeConsent() {
        PatientSessionEntity session = PatientSessionEntity.create("session-1", "hi-Hinglish");
        var harness = harness(session);

        assertThatThrownBy(() -> harness.service.accept(
                "session-1", candidate("fullName", "Luv Tankha")))
                .isInstanceOf(ResponseStatusException.class);
        verify(harness.patients, never()).save(any());
        verify(harness.visits, never()).save(any());
    }

    @Test
    void materializesExactlyOnePatientAndVisitAfterRequiredIdentity() {
        PatientSessionEntity session = PatientSessionEntity.create("session-1", "hi-Hinglish");
        session.recordConsent(true);
        var harness = harness(session);

        var name = harness.service.accept("session-1", candidate("fullName", "Luv Tankha"));
        var age = harness.service.accept("session-1", candidate("age", "21"));
        var completed = harness.service.accept("session-1", candidate("sex", "male"));

        assertThat(name.nextField()).isEqualTo("age");
        assertThat(age.nextField()).isEqualTo("sex");
        assertThat(completed.materialized()).isTrue();
        assertThat(completed.nextField()).isNull();
        assertThat(session.getPatientId()).isNotBlank();
        assertThat(session.getVisitId()).isNotBlank();
        verify(harness.patients).save(any(PatientProfileEntity.class));
        verify(harness.visits).save(any(VisitEntity.class));

        var retry = harness.service.accept("session-1", candidate("sex", "male"));
        assertThat(retry.materialized()).isTrue();
        verify(harness.patients).save(any(PatientProfileEntity.class));
        verify(harness.visits).save(any(VisitEntity.class));
    }

    private static Harness harness(PatientSessionEntity session) {
        PatientSessionRepository sessions = mock(PatientSessionRepository.class);
        PatientProfileRepository patients = mock(PatientProfileRepository.class);
        VisitRepository visits = mock(VisitRepository.class);
        when(sessions.findByIdForUpdate("session-1")).thenReturn(Optional.of(session));
        when(sessions.save(any(PatientSessionEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(patients.save(any(PatientProfileEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(visits.save(any(VisitEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        return new Harness(
                new PatientIdentityService(
                        sessions,
                        patients,
                        visits,
                        new IdentityCandidateValidator(),
                        new CuidGenerator()),
                patients,
                visits);
    }

    @Test
    void acceptsPhoneAfterRequiredIdentityFieldsInTheSameTurn() {
        var session = PatientSessionEntity.create("session-1", "hi-Hinglish");
        session.recordConsent(true);
        var harness = harness(session);
        var result = harness.service.acceptBatch("session-1", List.of(candidate("fullName", "Test Patient"),
                candidate("age", "28"), candidate("sex", "male"), candidate("phone", "9999999999")));
        assertThat(result.materialized()).isTrue();
        assertThat(session.identityValue("phone")).isEqualTo("9999999999");
        verify(harness.patients).save(any(PatientProfileEntity.class));
    }

    @Test
    void rejectsDuplicateFieldsWithoutMaterializingIdentity() {
        var session = PatientSessionEntity.create("session-1", "hi-Hinglish");
        session.recordConsent(true);
        var harness = harness(session);
        assertThatThrownBy(() -> harness.service.acceptBatch("session-1", List.of(
                candidate("age", "28"), candidate("age", "29")))).isInstanceOf(IllegalArgumentException.class);
        assertThat(session.identityValue("age")).isNull();
    }

    private static IdentityCandidate candidate(String field, String value) {
        return new IdentityCandidate(
                field,
                value,
                "HIGH",
                "PATIENT_REPORTED",
                List.of("turn-1"),
                "VoiceArena/Human-1",
                "test",
                "helios-v2-policy-1");
    }

    private record Harness(
            PatientIdentityService service,
            PatientProfileRepository patients,
            VisitRepository visits) {}
}
