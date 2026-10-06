package com.helios.patient.intake;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import com.helios.patient.common.id.CuidGenerator;
import com.helios.patient.patient.session.PatientSessionRepository;
import com.helios.patient.patient.session.PatientSessionResponse;
import com.helios.patient.patient.session.PatientSessionService;
import com.helios.patient.patient.session.PatientSessionEntity;

class IntakeSessionServiceTest {

    private static final String SESSION_ID = "c123456789012345678901234";

    @Test
    void persistsOnlyValidatedRuntimeFactsAndComputesNextIntent() {
        IntakeFactRepository facts = inMemoryFacts();
        PatientSessionRepository sessions = mock(PatientSessionRepository.class);
        PatientSessionEntity linked = linkedSession();
        when(sessions.findByIdForUpdate(SESSION_ID)).thenReturn(Optional.of(linked));
        when(sessions.existsById(SESSION_ID)).thenReturn(true);
        when(sessions.save(any(PatientSessionEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        PatientSessionService patientSessions = mock(PatientSessionService.class);
        when(patientSessions.get(anyString(), anyString())).thenReturn(new PatientSessionResponse(
                SESSION_ID, "proof", "IN_PROGRESS", "INTERVIEW", "hi-Hinglish", null, null, null));
        IntakeSessionService service = new IntakeSessionService(
                facts,
                sessions,
                patientSessions,
                new ClinicalFactValidator(),
                new FollowUpPolicyEngine(),
                new CuidGenerator());

        var saved = service.acceptRuntimeCandidate(
                SESSION_ID,
                candidate("chiefComplaint", "chest pressure", KnowledgeState.KNOWN, "turn-1"));
        var snapshot = service.get(SESSION_ID, "proof");

        assertThat(saved.field()).isEqualTo("chiefComplaint");
        assertThat(saved.source()).isEqualTo("PATIENT_REPORTED");
        assertThat(snapshot.facts()).hasSize(1);
        assertThat(snapshot.complete()).isFalse();
        assertThat(snapshot.nextIntent().targetField()).isEqualTo("breathingDifficulty");
        assertThat(snapshot.completedTurns()).isEqualTo(1);
    }

    @Test
    void updatesExistingFieldWithoutDroppingEvidenceProvenance() {
        IntakeFactRepository facts = inMemoryFacts();
        PatientSessionRepository sessions = mock(PatientSessionRepository.class);
        PatientSessionEntity linked = linkedSession();
        linked.beginInterview();
        when(sessions.findByIdForUpdate(SESSION_ID)).thenReturn(Optional.of(linked));
        when(sessions.existsById(SESSION_ID)).thenReturn(true);
        when(sessions.save(any(PatientSessionEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        IntakeSessionService service = new IntakeSessionService(
                facts,
                sessions,
                mock(PatientSessionService.class),
                new ClinicalFactValidator(),
                new FollowUpPolicyEngine(),
                new CuidGenerator());

        service.acceptRuntimeCandidate(
                SESSION_ID,
                candidate("severity", "8/10", KnowledgeState.KNOWN, "turn-2"));
        var updated = service.acceptRuntimeCandidate(
                SESSION_ID,
                candidate("severity", "6/10", KnowledgeState.KNOWN, "turn-3"));

        assertThat(updated.value()).isEqualTo("6/10");
        assertThat(updated.evidenceTurnIds()).containsExactly("turn-3");
        assertThat(facts.findByPatientSessionIdOrderByUpdatedAtAsc(SESSION_ID)).hasSize(1);
    }

    private static ClinicalFactCandidate candidate(
            String field,
            String value,
            KnowledgeState state,
            String evidenceTurnId) {
        return new ClinicalFactCandidate(
                field,
                value,
                state,
                "HIGH",
                "PATIENT_REPORTED",
                List.of(evidenceTurnId),
                "VoiceArena/Human-1",
                "test",
                "helios-v2-policy-1");
    }

    private static IntakeFactRepository inMemoryFacts() {
        IntakeFactRepository repository = mock(IntakeFactRepository.class);
        List<IntakeFactEntity> records = new ArrayList<>();
        when(repository.findByPatientSessionIdAndField(anyString(), anyString()))
                .thenAnswer(invocation -> records.stream()
                        .filter(item -> item.getPatientSessionId().equals(invocation.getArgument(0))
                                && item.getField().equals(invocation.getArgument(1)))
                        .findFirst());
        when(repository.save(any(IntakeFactEntity.class))).thenAnswer(invocation -> {
            IntakeFactEntity entity = invocation.getArgument(0);
            if (!records.contains(entity)) records.add(entity);
            return entity;
        });
        when(repository.findByPatientSessionIdOrderByUpdatedAtAsc(anyString()))
                .thenAnswer(invocation -> records.stream()
                        .filter(item -> item.getPatientSessionId().equals(invocation.getArgument(0)))
                        .toList());
        return repository;
    }

    private static PatientSessionEntity linkedSession() {
        PatientSessionEntity session = PatientSessionEntity.create(SESSION_ID, "hi-Hinglish");
        session.recordConsent(true);
        session.recordIdentityField("fullName", "Luv Tankha");
        session.recordIdentityField("age", "21");
        session.recordIdentityField("sex", "MALE");
        session.linkPatientVisit("patient-1", "visit-1");
        return session;
    }
}
