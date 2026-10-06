package com.helios.patient.voice;

import java.util.Map;

import org.springframework.stereotype.Service;

import com.helios.patient.patient.identity.PatientIdentityService.IdentityProgress;

@Service
public class VoiceIdentityCoordinator {

    private static final Map<String, Question> QUESTIONS = Map.of(
            "fullName", new Question("identity-full-name", "Sabse pehle, aapka poora naam kya hai?"),
            "age", new Question("identity-age", "Aapki age kitni hai?"),
            "sex", new Question(
                    "identity-sex",
                    "Aap male, female, other, ya prefer not to say mein se kya batana chahenge?"));
    private static final Question CHIEF_COMPLAINT = new Question(
            "opening-chief-complaint",
            "Ab batayein, aaj aapko kis health concern ya takleef ke baare mein doctor ko batana hai?");

    private final VoiceSessionRepository voiceSessions;
    private final VoiceRuntimeGateway runtimeGateway;
    private final VoiceEventStreamService events;

    public VoiceIdentityCoordinator(
            VoiceSessionRepository voiceSessions,
            VoiceRuntimeGateway runtimeGateway,
            VoiceEventStreamService events) {
        this.voiceSessions = voiceSessions;
        this.runtimeGateway = runtimeGateway;
        this.events = events;
    }

    public void onIdentityAccepted(IdentityProgress progress) {
        VoiceSessionEntity voiceSession = voiceSessions
                .findTopByPatientSessionIdOrderByCreatedAtDesc(progress.patientSessionId())
                .orElse(null);
        if (voiceSession == null
                || voiceSession.getState() == VoiceSessionState.ENDED
                || voiceSession.getState() == VoiceSessionState.COMPLETED) {
            return;
        }
        Question question = progress.materialized()
                ? CHIEF_COMPLAINT
                : QUESTIONS.get(progress.nextField());
        if (question == null) return;
        runtimeGateway.queueQuestion(voiceSession.getId(), question.id(), question.text());
        events.publish(
                voiceSession.getId(),
                VoiceUiEventType.DOCTOR_SPEAKING_CAPTION,
                Map.of("text", question.text()));
    }

    private record Question(String id, String text) {}
}
