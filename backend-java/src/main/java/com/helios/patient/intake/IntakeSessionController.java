package com.helios.patient.intake;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v2/intake-sessions")
public class IntakeSessionController {

    private final IntakeSessionService service;

    public IntakeSessionController(IntakeSessionService service) {
        this.service = service;
    }

    @GetMapping("/{patientSessionId}")
    public IntakeSessionService.IntakeSessionResponse get(
            @PathVariable String patientSessionId,
            @RequestHeader(name = "x-session-token", required = false) String sessionProof) {
        return service.get(patientSessionId, sessionProof);
    }

    @GetMapping("/{patientSessionId}/summary")
    public IntakeSessionService.IntakeSessionResponse summary(
            @PathVariable String patientSessionId,
            @RequestHeader(name = "x-session-token", required = false) String sessionProof) {
        return service.get(patientSessionId, sessionProof);
    }
}
