package com.helios.patient.voice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import com.helios.patient.intake.FollowUpIntent;
import com.helios.patient.intake.IntakeSessionService;
import com.helios.patient.patient.session.PatientSessionEntity;
import com.helios.patient.patient.session.PatientSessionRepository;
import com.helios.patient.visit.VisitEntity;
import com.helios.patient.visit.VisitRepository;
import com.helios.patient.visit.VisitStatus;
import com.helios.patient.routing.IntakeHandoffService;

class VoiceConversationCoordinatorTest {

    private static final String PATIENT_SESSION_ID = "patient-1";
    private static final String VOICE_SESSION_ID = "voice-1";

    @Test
    void queuesOnlyTheAuthoritativeNextQuestion() {
        IntakeSessionService intake = mock(IntakeSessionService.class);
        VoiceSessionRepository sessions = mock(VoiceSessionRepository.class);
        VoiceRuntimeGateway runtime = mock(VoiceRuntimeGateway.class);
        PatientSessionRepository patientSessions = mock(PatientSessionRepository.class);
        VisitRepository visits = mock(VisitRepository.class);
        var voice = activeVoiceSession();
        var intent = new FollowUpIntent(
                "collect-onset",
                "onset",
                "Clarify onset",
                FollowUpIntent.Priority.CLINICAL_CONTEXT,
                true);
        when(sessions.findTopByPatientSessionIdOrderByCreatedAtDesc(PATIENT_SESSION_ID))
                .thenReturn(Optional.of(voice));
        when(intake.internalSnapshot(PATIENT_SESSION_ID))
                .thenReturn(new IntakeSessionService.IntakeSessionResponse(
                        PATIENT_SESSION_ID,
                        List.of(),
                        false,
                        intent,
                        "onset is missing",
                        1));
        var coordinator = new VoiceConversationCoordinator(
                intake,
                sessions,
                runtime,
                new FollowUpQuestionRealizer(),
                new VoiceEventStreamService(),
                patientSessions,
                visits,
                mock(IntakeHandoffService.class));

        coordinator.onFactAccepted(PATIENT_SESSION_ID);

        verify(runtime).queueQuestion(
                VOICE_SESSION_ID,
                "collect-onset",
                "Yeh problem kab se shuru hui?");
        assertThat(voice.getState()).isEqualTo(VoiceSessionState.ACTIVE);
    }

    @Test
    void completesConversationWhenRequiredIntakeIsCovered() {
        IntakeSessionService intake = mock(IntakeSessionService.class);
        VoiceSessionRepository sessions = mock(VoiceSessionRepository.class);
        VoiceRuntimeGateway runtime = mock(VoiceRuntimeGateway.class);
        PatientSessionRepository patientSessions = mock(PatientSessionRepository.class);
        VisitRepository visits = mock(VisitRepository.class);
        var voice = activeVoiceSession();
        PatientSessionEntity patientSession =
                PatientSessionEntity.create(PATIENT_SESSION_ID, "hi-Hinglish");
        patientSession.recordConsent(true);
        patientSession.recordIdentityField("fullName", "Luv Tankha");
        patientSession.recordIdentityField("age", "21");
        patientSession.recordIdentityField("sex", "MALE");
        patientSession.linkPatientVisit("patient-profile-1", "visit-1");
        VisitEntity visit = new VisitEntity("visit-1", "patient-profile-1");
        when(sessions.findTopByPatientSessionIdOrderByCreatedAtDesc(PATIENT_SESSION_ID))
                .thenReturn(Optional.of(voice));
        when(intake.internalSnapshot(PATIENT_SESSION_ID))
                .thenReturn(new IntakeSessionService.IntakeSessionResponse(
                        PATIENT_SESSION_ID,
                        List.of(),
                        true,
                        null,
                        "required intake is complete",
                        8));
        when(patientSessions.findByIdForUpdate(PATIENT_SESSION_ID))
                .thenReturn(Optional.of(patientSession));
        when(visits.findById("visit-1")).thenReturn(Optional.of(visit));
        var handoff = mock(IntakeHandoffService.class);
        when(handoff.handoff(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(new IntakeHandoffService.Handoff("internal-medicine", "doctor-1", false));
        var coordinator = new VoiceConversationCoordinator(
                intake,
                sessions,
                runtime,
                new FollowUpQuestionRealizer(),
                new VoiceEventStreamService(),
                patientSessions,
                visits,
                handoff);

        coordinator.onFactAccepted(PATIENT_SESSION_ID);

        assertThat(voice.getState()).isEqualTo(VoiceSessionState.COMPLETED);
        assertThat(patientSession.getStatus().name()).isEqualTo("READY_FOR_REVIEW");
        assertThat(patientSession.getCurrentStep().name()).isEqualTo("REVIEW");
        assertThat(visit.getStatus()).isEqualTo(VisitStatus.READY_FOR_DOCTOR);
        verify(sessions).save(voice);
        verify(patientSessions).save(patientSession);
        verify(visits).save(visit);
        verify(runtime, never()).queueQuestion(
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString());
    }

    private static VoiceSessionEntity activeVoiceSession() {
        return new VoiceSessionEntity(
                VOICE_SESSION_ID,
                PATIENT_SESSION_ID,
                null,
                VoiceSessionState.ACTIVE,
                "lead-general",
                0,
                Instant.parse("2026-10-04T00:00:00Z"));
    }
}
