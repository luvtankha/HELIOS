package com.helios.patient.voice;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import reactor.core.publisher.Flux;

@RestController
@RequestMapping("/api/v2/voice-sessions")
public class VoiceSessionController {

    private final VoiceSessionService service;

    public VoiceSessionController(VoiceSessionService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<VoiceSessionResponse> create(
            @RequestBody CreateVoiceSessionRequest request,
            @RequestHeader(name = "x-session-token", required = false) String sessionProof) {
        var capabilities = request.capabilities();
        String languageMode = capabilities == null ? null : capabilities.languageMode();
        boolean bargeIn = capabilities != null && capabilities.bargeIn();
        var response = service.create(
                request.patientSessionId(), request.visitId(), languageMode, bargeIn, sessionProof);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{voiceSessionId}")
    public VoiceSessionResponse get(
            @PathVariable String voiceSessionId,
            @RequestHeader(name = "x-session-token", required = false) String sessionProof) {
        return service.get(voiceSessionId, sessionProof);
    }

    @PostMapping("/{voiceSessionId}/resume")
    public VoiceSessionResponse resume(
            @PathVariable String voiceSessionId,
            @RequestBody(required = false) ResumeVoiceSessionRequest request,
            @RequestHeader(name = "x-session-token", required = false) String sessionProof) {
        long sequence = request == null ? 0 : request.lastAcknowledgedSequence();
        return service.resume(voiceSessionId, sequence, sessionProof);
    }

    @DeleteMapping("/{voiceSessionId}")
    public ResponseEntity<Void> end(
            @PathVariable String voiceSessionId,
            @RequestHeader(name = "x-session-token", required = false) String sessionProof) {
        service.end(voiceSessionId, sessionProof);
        return ResponseEntity.noContent().build();
    }

    @GetMapping(value = "/{voiceSessionId}/events", produces = MediaType.APPLICATION_NDJSON_VALUE)
    public Flux<VoiceUiEvent> events(
            @PathVariable String voiceSessionId,
            @RequestParam(name = "after", defaultValue = "0") long afterSequence,
            @RequestHeader(name = "x-session-token", required = false) String sessionProof) {
        return service.events(voiceSessionId, afterSequence, sessionProof);
    }

    public record CreateVoiceSessionRequest(
            String patientSessionId,
            String visitId,
            Capabilities capabilities) {}

    public record Capabilities(boolean bargeIn, String languageMode) {}

    public record ResumeVoiceSessionRequest(long lastAcknowledgedSequence) {}
}
