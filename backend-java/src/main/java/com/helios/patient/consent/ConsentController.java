package com.helios.patient.consent;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v2/consents")
public class ConsentController {
    private final ConsentService service;

    public ConsentController(ConsentService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<ConsentService.ConsentResponse> record(
            @RequestBody ConsentRequest request,
            @RequestHeader(name = "x-session-token", required = false) String sessionProof) {
        var response = service.record(
                request.sessionId(), request.consentType(), request.accepted(), request.version(), sessionProof);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    public record ConsentRequest(String sessionId, String consentType, boolean accepted, String version) {}
}
