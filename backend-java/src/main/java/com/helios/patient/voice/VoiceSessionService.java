package com.helios.patient.voice;

import java.time.Clock;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.helios.patient.common.id.CuidGenerator;
import com.helios.patient.patient.session.PatientSessionService;

/**
 * Durable voice-control session registry.
 *
 * This deliberately does not pretend the Phase 4 model benchmark has passed.
 * Control/session state is persisted so reconnect and restart do not erase it.
 */
@Service
public class VoiceSessionService {

    private static final String LANGUAGE_MODE = PatientSessionService.LANGUAGE_MODE;
    private static final String DEFAULT_AVATAR = "lead-general";
    private static final String OPENING_QUESTION_ID = "chief-complaint-opening";
    private static final String OPENING_QUESTION =
            "नमस्ते! आपको क्या तकलीफ़ हो रही है?";

    private final PatientSessionService patientSessions;
    private final CuidGenerator ids;
    private final VoiceEventStreamService events;
    private final VoiceSessionRepository repository;
    private final VoiceRuntimeGateway runtimeGateway;
    private final Clock clock;

    @Autowired
    public VoiceSessionService(
            PatientSessionService patientSessions,
            CuidGenerator ids,
            VoiceEventStreamService events,
            VoiceSessionRepository repository,
            VoiceRuntimeGateway runtimeGateway) {
        this(patientSessions, ids, events, repository, runtimeGateway, Clock.systemUTC());
    }

    VoiceSessionService(
            PatientSessionService patientSessions,
            CuidGenerator ids,
            VoiceEventStreamService events,
            VoiceSessionRepository repository,
            VoiceRuntimeGateway runtimeGateway,
            Clock clock) {
        this.patientSessions = patientSessions;
        this.ids = ids;
        this.events = events;
        this.repository = repository;
        this.runtimeGateway = runtimeGateway;
        this.clock = clock;
    }

    @Transactional
    public VoiceSessionResponse create(
            String patientSessionId,
            String visitId,
            String languageMode,
            boolean bargeIn,
            String patientSessionProof) {
        if (patientSessionId == null || patientSessionId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "patientSessionId is required");
        }
        if (!LANGUAGE_MODE.equals(languageMode)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "voice session requires Hindi/Hinglish mode");
        }
        if (!bargeIn) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "HELIOS live consultation requires barge-in support");
        }
        var patientSession = patientSessions.getForUpdate(patientSessionId, patientSessionProof);
        if (!java.util.Set.of("BASIC_INFO", "CHIEF_COMPLAINT", "INTERVIEW").contains(patientSession.currentStep())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "patient session is not open for live voice intake");
        }
        if (visitId != null && !visitId.equals(patientSession.visitId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "visit does not belong to patient session");
        }
        var existing = repository.findTopByPatientSessionIdOrderByCreatedAtDesc(patientSessionId);
        if (existing.isPresent() && existing.get().getState() != VoiceSessionState.ENDED
                && existing.get().getState() != VoiceSessionState.COMPLETED) {
            events.open(existing.get().getId());
            return response(existing.get());
        }

        var session = new VoiceSessionEntity(
                ids.next(), patientSessionId, patientSession.visitId(), VoiceSessionState.WAITING_FOR_RUNTIME,
                DEFAULT_AVATAR, 0, clock.instant());
        VoiceSessionEntity saved = repository.save(session);
        events.open(saved.getId());
        VoiceRuntimeGateway.RuntimeAccess access =
                runtimeGateway.prepare(saved.getId(), saved.getPatientSessionId());
        if (access.available()) {
            try {
                runtimeGateway.queueQuestion(saved.getId(), OPENING_QUESTION_ID, OPENING_QUESTION);
                saved.transitionTo(VoiceSessionState.CONNECTING);
                saved = repository.save(saved);
                // Captions come from generated audio, never from an unsaid instruction.
            } catch (RuntimeException exception) {
                access = VoiceRuntimeGateway.RuntimeAccess.unavailable(
                        "Voice runtime control plane could not queue the opening question.");
            }
        }
        return response(saved, access);
    }

    @Transactional(readOnly = true)
    public VoiceSessionResponse get(String voiceSessionId, String patientSessionProof) {
        VoiceSessionEntity session = requireSession(voiceSessionId);
        patientSessions.get(session.getPatientSessionId(), patientSessionProof);
        return response(session);
    }

    @Transactional
    public VoiceSessionResponse resume(
            String voiceSessionId,
            long lastAcknowledgedSequence,
            String patientSessionProof) {
        VoiceSessionEntity current = requireSession(voiceSessionId);
        patientSessions.getForUpdate(current.getPatientSessionId(), patientSessionProof);
        current = requireSession(voiceSessionId);
        if (lastAcknowledgedSequence < 0 || lastAcknowledgedSequence < current.getLastAcknowledgedSequence()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid acknowledgement sequence");
        }
        if (current.getState() == VoiceSessionState.ENDED || current.getState() == VoiceSessionState.COMPLETED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "voice session is already closed");
        }
        current.acknowledge(lastAcknowledgedSequence);
        return response(repository.save(current));
    }

    @Transactional
    public void end(String voiceSessionId, String patientSessionProof) {
        VoiceSessionEntity current = requireSession(voiceSessionId);
        patientSessions.getForUpdate(current.getPatientSessionId(), patientSessionProof);
        current = requireSession(voiceSessionId);
        if (current.getState() == VoiceSessionState.COMPLETED || current.getState() == VoiceSessionState.ENDED) return;
        current.transitionTo(VoiceSessionState.ENDED);
        repository.save(current);
        events.close(voiceSessionId, null);
    }

    public reactor.core.publisher.Flux<VoiceUiEvent> events(
            String voiceSessionId,
            long afterSequence,
            String patientSessionProof) {
        VoiceSessionEntity current = requireSession(voiceSessionId);
        patientSessions.get(current.getPatientSessionId(), patientSessionProof);
        return events.stream(voiceSessionId, afterSequence);
    }

    private VoiceSessionEntity requireSession(String voiceSessionId) {
        return repository.findById(voiceSessionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "voice session not found"));
    }

    private VoiceSessionResponse response(VoiceSessionEntity session) {
        if (session.getState() == VoiceSessionState.ENDED || session.getState() == VoiceSessionState.COMPLETED) {
            return response(session, VoiceRuntimeGateway.RuntimeAccess.unavailable("Voice session is closed."));
        }
        VoiceRuntimeGateway.RuntimeAccess access =
                runtimeGateway.prepare(session.getId(), session.getPatientSessionId());
        return response(session, access);
    }

    private VoiceSessionResponse response(
            VoiceSessionEntity session,
            VoiceRuntimeGateway.RuntimeAccess access) {
        return new VoiceSessionResponse(
                session.getId(),
                session.getPatientSessionId(),
                session.getVisitId(),
                session.getState().name(),
                new VoiceSessionResponse.Media(
                        access.available(),
                        access.transport(),
                        access.websocketUrl(),
                        access.credential(),
                        access.expiresAt(),
                        access.detail()),
                new VoiceSessionResponse.Conversation(LANGUAGE_MODE, session.getDoctorAvatarId(), true),
                session.getLastAcknowledgedSequence(),
                session.getCreatedAt());
    }
}
