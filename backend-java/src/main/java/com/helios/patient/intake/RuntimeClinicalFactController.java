package com.helios.patient.intake;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.helios.patient.voice.VoiceRuntimeControlAuthorizer;
import com.helios.patient.voice.VoiceConversationCoordinator;

@RestController
@RequestMapping("/internal/v2/voice-runtime")
public class RuntimeClinicalFactController {

    private final IntakeSessionService service;
    private final VoiceRuntimeControlAuthorizer authorizer;
    private final VoiceConversationCoordinator coordinator;

    public RuntimeClinicalFactController(
            IntakeSessionService service,
            VoiceRuntimeControlAuthorizer authorizer,
            VoiceConversationCoordinator coordinator) {
        this.service = service;
        this.authorizer = authorizer;
        this.coordinator = coordinator;
    }

    @PostMapping("/facts")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public IntakeSessionService.IntakeFactResponse fact(
            @RequestBody RuntimeFactRequest request,
            @RequestHeader(name = "Authorization", required = false) String authorization) {
        authorizer.require(authorization);
        var accepted = service.acceptRuntimeCandidate(request.patientSessionId(), request.candidate());
        coordinator.onFactAccepted(request.patientSessionId());
        return accepted;
    }

    public record RuntimeFactRequest(
            String patientSessionId,
            ClinicalFactCandidate candidate) {}
}
