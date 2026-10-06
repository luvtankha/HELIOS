package com.helios.patient.patient.identity;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.helios.patient.voice.VoiceIdentityCoordinator;
import com.helios.patient.voice.VoiceRuntimeControlAuthorizer;

@RestController
@RequestMapping("/internal/v2/voice-runtime")
public class RuntimePatientIdentityController {

    private final PatientIdentityService identities;
    private final VoiceRuntimeControlAuthorizer authorizer;
    private final VoiceIdentityCoordinator coordinator;

    public RuntimePatientIdentityController(
            PatientIdentityService identities,
            VoiceRuntimeControlAuthorizer authorizer,
            VoiceIdentityCoordinator coordinator) {
        this.identities = identities;
        this.authorizer = authorizer;
        this.coordinator = coordinator;
    }

    @PostMapping("/identity")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public PatientIdentityService.IdentityProgress identity(
            @RequestBody RuntimeIdentityRequest request,
            @RequestHeader(name = "Authorization", required = false) String authorization) {
        authorizer.require(authorization);
        var progress = identities.accept(request.patientSessionId(), request.candidate());
        coordinator.onIdentityAccepted(progress);
        return progress;
    }

    public record RuntimeIdentityRequest(
            String patientSessionId,
            IdentityCandidate candidate) {}
}
