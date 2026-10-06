package com.helios.patient.voice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import com.helios.patient.common.id.CuidGenerator;
import com.helios.patient.patient.session.PatientSessionResponse;
import com.helios.patient.patient.session.PatientSessionService;

class VoiceSessionServiceTest {

    private static final String PATIENT_SESSION_ID = "c123456789012345678901234";
    private static final String PROOF = "valid-proof";

    @Test
    void createsControlSessionButDoesNotPretendMediaBenchmarkPassed() {
        VoiceSessionService service = serviceWithAuthorizedPatient();

        VoiceSessionResponse response = service.create(
                PATIENT_SESSION_ID, null, "hi-Hinglish", true, PROOF);

        assertThat(response.state()).isEqualTo("WAITING_FOR_RUNTIME");
        assertThat(response.media().available()).isFalse();
        assertThat(response.media().transport()).isEqualTo("PENDING_PHASE4_BENCHMARK");
        assertThat(response.conversation().languageMode()).isEqualTo("hi-Hinglish");
        assertThat(response.conversation().bargeIn()).isTrue();
    }

    @Test
    void rejectsEnglishOnlyVoiceMode() {
        VoiceSessionService service = serviceWithAuthorizedPatient();
        assertThatThrownBy(() -> service.create(PATIENT_SESSION_ID, null, "en", true, PROOF))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void rejectsVoiceSessionWithoutBargeInCapability() {
        VoiceSessionService service = serviceWithAuthorizedPatient();
        assertThatThrownBy(() -> service.create(PATIENT_SESSION_ID, null, "hi-Hinglish", false, PROOF))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void rejectsLiveVoiceBeforeConsentIsCompleted() {
        PatientSessionService patientSessions = mock(PatientSessionService.class);
        when(patientSessions.getForUpdate(anyString(), anyString())).thenReturn(new PatientSessionResponse(
                PATIENT_SESSION_ID, null, "STARTED", "CONSENT", "hi-Hinglish", null, null, null));
        VoiceSessionService service = new VoiceSessionService(
                patientSessions,
                new CuidGenerator(),
                new VoiceEventStreamService(),
                inMemoryRepository(),
                blockedGateway(),
                Clock.fixed(Instant.parse("2026-10-04T00:00:00Z"), ZoneOffset.UTC));

        assertThatThrownBy(() -> service.create(PATIENT_SESSION_ID, null, "hi-Hinglish", true, PROOF))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void resumeSequenceCannotMoveBackwards() {
        VoiceSessionService service = serviceWithAuthorizedPatient();
        VoiceSessionResponse created = service.create(PATIENT_SESSION_ID, null, "hi-Hinglish", true, PROOF);
        service.resume(created.voiceSessionId(), 9, PROOF);

        assertThatThrownBy(() -> service.resume(created.voiceSessionId(), 8, PROOF))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void voiceSessionSurvivesServiceRecreation() {
        VoiceSessionRepository repository = inMemoryRepository();
        VoiceSessionService first = serviceWithAuthorizedPatient(repository);
        VoiceSessionResponse created = first.create(PATIENT_SESSION_ID, null, "hi-Hinglish", true, PROOF);

        VoiceSessionService restarted = serviceWithAuthorizedPatient(repository);
        VoiceSessionResponse restored = restarted.get(created.voiceSessionId(), PROOF);

        assertThat(restored.voiceSessionId()).isEqualTo(created.voiceSessionId());
        assertThat(restored.patientSessionId()).isEqualTo(PATIENT_SESSION_ID);
        assertThat(restored.state()).isEqualTo("WAITING_FOR_RUNTIME");
    }

    @Test
    void advertisesMediaOnlyWhenRuntimeGatePasses() {
        PatientSessionService patientSessions = mock(PatientSessionService.class);
        when(patientSessions.getForUpdate(anyString(), anyString())).thenReturn(new PatientSessionResponse(
                PATIENT_SESSION_ID, null, "IN_PROGRESS", "BASIC_INFO", "hi-Hinglish", null, null, null));
        Instant expiry = Instant.parse("2026-10-04T00:00:45Z");
        VoiceRuntimeGateway readyGateway = (voiceSessionId, patientSessionId) ->
                new VoiceRuntimeGateway.RuntimeAccess(
                        true,
                        "WEBSOCKET_PCM16",
                        "ws://localhost:9090/v1/stream",
                        "signed-runtime-ticket",
                        expiry,
                        null);
        VoiceSessionService service = new VoiceSessionService(
                patientSessions,
                new CuidGenerator(),
                new VoiceEventStreamService(),
                inMemoryRepository(),
                readyGateway,
                Clock.fixed(Instant.parse("2026-10-04T00:00:00Z"), ZoneOffset.UTC));

        VoiceSessionResponse response = service.create(
                PATIENT_SESSION_ID, null, "hi-Hinglish", true, PROOF);

        assertThat(response.media().available()).isTrue();
        assertThat(response.media().transport()).isEqualTo("WEBSOCKET_PCM16");
        assertThat(response.media().websocketUrl()).isEqualTo("ws://localhost:9090/v1/stream");
        assertThat(response.media().credential()).isEqualTo("signed-runtime-ticket");
        assertThat(response.media().expiresAt()).isEqualTo(expiry);
        assertThat(response.media().detail()).isNull();
    }

    private static VoiceSessionService serviceWithAuthorizedPatient() {
        return serviceWithAuthorizedPatient(inMemoryRepository());
    }

    private static VoiceSessionService serviceWithAuthorizedPatient(VoiceSessionRepository repository) {
        PatientSessionService patientSessions = mock(PatientSessionService.class);
        when(patientSessions.getForUpdate(anyString(), anyString())).thenReturn(new PatientSessionResponse(
                PATIENT_SESSION_ID, null, "IN_PROGRESS", "BASIC_INFO", "hi-Hinglish", null, null, null));
        return new VoiceSessionService(
                patientSessions,
                new CuidGenerator(),
                new VoiceEventStreamService(Clock.fixed(Instant.parse("2026-10-04T00:00:00Z"), ZoneOffset.UTC)),
                repository,
                blockedGateway(),
                Clock.fixed(Instant.parse("2026-10-04T00:00:00Z"), ZoneOffset.UTC));
    }

    private static VoiceRuntimeGateway blockedGateway() {
        return (voiceSessionId, patientSessionId) ->
                VoiceRuntimeGateway.RuntimeAccess.unavailable(
                        "Realtime media remains disabled until the full-duplex Hindi/Hinglish benchmark gate passes.");
    }

    private static VoiceSessionRepository inMemoryRepository() {
        VoiceSessionRepository repository = mock(VoiceSessionRepository.class);
        Map<String, VoiceSessionEntity> records = new ConcurrentHashMap<>();
        when(repository.save(any(VoiceSessionEntity.class))).thenAnswer(invocation -> {
            VoiceSessionEntity entity = invocation.getArgument(0);
            records.put(entity.getId(), entity);
            return entity;
        });
        when(repository.findById(anyString())).thenAnswer(invocation ->
                Optional.ofNullable(records.get(invocation.getArgument(0))));
        when(repository.findTopByPatientSessionIdOrderByCreatedAtDesc(anyString())).thenAnswer(invocation ->
                records.values().stream().filter(record -> record.getPatientSessionId().equals(invocation.getArgument(0))).findFirst());
        return repository;
    }

    @Test
    void repeatedCreateReusesTheActiveVoiceSession() {
        var service = serviceWithAuthorizedPatient();
        var first = service.create(PATIENT_SESSION_ID, null, "hi-Hinglish", true, PROOF);
        var second = service.create(PATIENT_SESSION_ID, null, "hi-Hinglish", true, PROOF);
        assertThat(second.voiceSessionId()).isEqualTo(first.voiceSessionId());
    }

    @Test
    void rejectsVisitThatDoesNotBelongToSession() {
        var service = serviceWithAuthorizedPatient();
        assertThatThrownBy(() -> service.create(PATIENT_SESSION_ID, "another-patients-visit", "hi-Hinglish", true, PROOF))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("403");
    }

    @Test
    void closedSessionCannotMintAnotherRuntimeCredential() {
        var repository = inMemoryRepository();
        var service = serviceWithAuthorizedPatient(repository);
        var created = service.create(PATIENT_SESSION_ID, null, "hi-Hinglish", true, PROOF);
        repository.findById(created.voiceSessionId()).orElseThrow().transitionTo(VoiceSessionState.COMPLETED);
        service.end(created.voiceSessionId(), PROOF);
        var response = service.get(created.voiceSessionId(), PROOF);
        assertThat(response.state()).isEqualTo("COMPLETED");
        assertThat(response.media().available()).isFalse();
        assertThat(response.media().credential()).isNull();
    }
}
