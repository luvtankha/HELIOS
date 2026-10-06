package com.helios.patient.voice;

import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.helios.patient.intake.IntakeSessionService;
import com.helios.patient.patient.session.PatientSessionRepository;
import com.helios.patient.visit.VisitRepository;
import com.helios.patient.routing.IntakeHandoffService;

@Service
public class VoiceConversationCoordinator {

    private final IntakeSessionService intakeSessions;
    private final VoiceSessionRepository voiceSessions;
    private final VoiceRuntimeGateway runtimeGateway;
    private final FollowUpQuestionRealizer questionRealizer;
    private final VoiceEventStreamService events;
    private final PatientSessionRepository patientSessions;
    private final VisitRepository visits;
    private final IntakeHandoffService handoff;

    public VoiceConversationCoordinator(
            IntakeSessionService intakeSessions,
            VoiceSessionRepository voiceSessions,
            VoiceRuntimeGateway runtimeGateway,
            FollowUpQuestionRealizer questionRealizer,
            VoiceEventStreamService events,
            PatientSessionRepository patientSessions,
            VisitRepository visits,
            IntakeHandoffService handoff) {
        this.intakeSessions = intakeSessions;
        this.voiceSessions = voiceSessions;
        this.runtimeGateway = runtimeGateway;
        this.questionRealizer = questionRealizer;
        this.events = events;
        this.patientSessions = patientSessions;
        this.visits = visits;
        this.handoff = handoff;
    }

    @Transactional
    public void onFactAccepted(String patientSessionId) {
        advance(patientSessionId, true);
    }

    @Transactional
    public Map<String, Object> onTurnAccepted(String patientSessionId) {
        return advance(patientSessionId, false);
    }

    private Map<String, Object> advance(String patientSessionId, boolean deliverQuestion) {
        VoiceSessionEntity voiceSession = voiceSessions
                .findTopByPatientSessionIdOrderByCreatedAtDesc(patientSessionId)
                .orElse(null);
        if (voiceSession == null
                || voiceSession.getState() == VoiceSessionState.ENDED
                || voiceSession.getState() == VoiceSessionState.COMPLETED) {
            return Map.of("complete", voiceSession != null && voiceSession.getState() == VoiceSessionState.COMPLETED);
        }

        var snapshot = intakeSessions.internalSnapshot(patientSessionId);
        if (snapshot.complete() || handoff.emergency(snapshot)) {
            var patientSession = patientSessions.findByIdForUpdate(patientSessionId)
                    .orElseThrow(() -> new IllegalStateException("patient session disappeared during intake"));
            if (patientSession.getVisitId() == null) {
                throw new IllegalStateException("completed intake has no linked visit");
            }
            var visit = visits.findById(patientSession.getVisitId())
                    .orElseThrow(() -> new IllegalStateException("linked visit does not exist"));
            var routed = handoff.handoff(patientSession, visit, snapshot);
            patientSession.readyForReview();
            visit.readyForDoctor();
            patientSessions.save(patientSession);
            visits.save(visit);
            voiceSession.transitionTo(VoiceSessionState.COMPLETED);
            voiceSessions.save(voiceSession);
            String avatar = routed.specialization().contains("surg") ? "clinician-surgical"
                    : "internal-medicine".equals(routed.specialization()) ? "clinician-female" : "clinician-general";
            if (deliverQuestion) events.publish(
                    voiceSession.getId(),
                    VoiceUiEventType.CONVERSATION_COMPLETED,
                    Map.of("specialization", routed.specialization(),
                            "assigned", routed.doctorId() != null,
                            "emergency", routed.emergency()));
            return Map.of("complete", true, "specialization", routed.specialization(),
                    "doctorAvatarId", avatar,
                    "assigned", routed.doctorId() != null, "emergency", routed.emergency(),
                    "instruction", routed.emergency()
                            ? "Explain in Hindi: the reported symptoms may need immediate medical evaluation. Contact local emergency services or go to the nearest emergency department now; do not wait for a routine appointment. Do not diagnose. The captured intake is saved."
                            : routed.doctorId() == null
                            ? "Intake is saved and awaiting clinic assignment. Explain this in Hindi."
                            : "Intake is saved and assigned to a doctor. Explain this in Hindi.");
        }

        var intent = snapshot.nextIntent();
        String question = questionRealizer.realize(intent);
        if (deliverQuestion) runtimeGateway.queueQuestion(voiceSession.getId(), intent.id(), question);
        if (deliverQuestion) events.publish(
                voiceSession.getId(),
                VoiceUiEventType.DOCTOR_SPEAKING_CAPTION,
                Map.of("text", question));
        return Map.of("complete", false, "nextQuestion", question, "nextField", intent.targetField(),
                "instruction", "Ask only this approved question, naturally in Hindi, adapted to the reported symptom.");
    }
}
