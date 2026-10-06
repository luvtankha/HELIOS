package com.helios.patient.voice;

import java.util.List;
import java.util.Map;

import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

import com.helios.patient.intake.ClinicalFactCandidate;
import com.helios.patient.intake.IntakeSessionService;
import com.helios.patient.patient.identity.IdentityCandidate;
import com.helios.patient.patient.identity.PatientIdentityService;

/** A whole spoken turn is committed before choosing a single next question. */
@RestController
@RequestMapping("/internal/v2/voice-runtime")
public class RuntimeTurnController {
    private final VoiceRuntimeControlAuthorizer authorizer;
    private final PatientIdentityService identities;
    private final IntakeSessionService intake;
    private final VoiceConversationCoordinator coordinator;
    private final VoiceSessionRepository voiceSessions;

    public RuntimeTurnController(VoiceRuntimeControlAuthorizer authorizer, PatientIdentityService identities,
            IntakeSessionService intake, VoiceConversationCoordinator coordinator, VoiceSessionRepository voiceSessions) {
        this.authorizer = authorizer;
        this.identities = identities;
        this.intake = intake;
        this.coordinator = coordinator;
        this.voiceSessions = voiceSessions;
    }

    @PostMapping("/turn")
    @Transactional
    public Map<String, Object> turn(@RequestBody Turn request,
            @RequestHeader(name = "Authorization", required = false) String authorization) {
        authorizer.require(authorization);
        if (request.patientSessionId() == null || request.patientSessionId().isBlank()
                || (request.identity() != null && request.identity().size() > 4)
                || (request.facts() != null && request.facts().size() > 32)) {
            throw new IllegalArgumentException("invalid patient turn");
        }
        requireActive(request.patientSessionId(), request.voiceSessionId());
        if (request.identity() != null) {
            identities.acceptBatch(request.patientSessionId(), request.identity());
        }
        var progress = identities.progress(request.patientSessionId());
        if (request.facts() != null) {
            request.facts().forEach(candidate -> intake.acceptRuntimeCandidate(request.patientSessionId(), candidate));
        }
        if (!progress.materialized()) {
            String question = switch (progress.nextField()) {
                case "fullName" -> "आपका पूरा नाम क्या है?";
                case "age" -> "आपकी उम्र कितनी है?";
                case "sex" -> "आप अपना लिंग क्या बताना चाहेंगे? आप चाहें तो यह जानकारी न देने का विकल्प भी चुन सकते हैं।";
                default -> throw new IllegalStateException("identity progress is invalid");
            };
            return Map.of("accepted", true, "identityComplete", false, "complete", false,
                    "nextQuestion", question, "instruction", "Symptoms are saved. Ask this identity question in Hindi without asking the patient to repeat their concern.");
        }
        return coordinator.onTurnAccepted(request.patientSessionId());
    }

    public record Turn(String patientSessionId, String voiceSessionId, List<IdentityCandidate> identity, List<ClinicalFactCandidate> facts) {}

    @GetMapping("/context")
    @Transactional
    public Map<String, Object> context(@RequestParam String patientSessionId, @RequestParam String voiceSessionId,
            @RequestHeader(name = "Authorization", required = false) String authorization) {
        authorizer.require(authorization);
        requireActive(patientSessionId, voiceSessionId);
        var progress = identities.progress(patientSessionId);
        var snapshot = intake.internalSnapshot(patientSessionId);
        return Map.of("identityComplete", progress.materialized(),
                "nextIdentityField", progress.nextField() == null ? "" : progress.nextField(),
                "facts", snapshot.facts(), "complete", snapshot.complete(),
                "nextQuestion", progress.materialized()
                        ? snapshot.complete() ? "" : new FollowUpQuestionRealizer().realize(snapshot.nextIntent())
                        : snapshot.facts().stream().noneMatch(fact -> "chiefComplaint".equals(fact.field())) ? "नमस्ते! आपको क्या तकलीफ़ हो रही है?"
                        : "fullName".equals(progress.nextField()) ? "आपका पूरा नाम क्या है?"
                        : "age".equals(progress.nextField()) ? "आपकी उम्र कितनी है?"
                        : "आप अपना लिंग क्या बताना चाहेंगे? यह जानकारी देना वैकल्पिक है।");
    }

    private void requireActive(String patientSessionId, String voiceSessionId) {
        intake.requireActiveRuntime(patientSessionId);
        var voice = voiceSessions.findTopByPatientSessionIdOrderByCreatedAtDesc(patientSessionId)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT, "voice session is not active"));
        if (!voice.getId().equals(voiceSessionId) || voice.getState() == VoiceSessionState.ENDED
                || voice.getState() == VoiceSessionState.COMPLETED) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT, "voice session is not active");
        }
    }
}
