package com.helios.patient.patient.session;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

@RestController
@RequestMapping("/api/v2/patient-sessions")
public class PatientSessionController {

    private final PatientSessionService service;

    public PatientSessionController(PatientSessionService service) {
        this.service = service;
    }

    @PostMapping
    public Mono<ResponseEntity<PatientSessionResponse>> create(
            @RequestBody(required = false) CreatePatientSessionRequest request) {
        String language = request == null ? null : request.conversationLanguage();
        return Mono.fromCallable(() -> service.create(language))
                .subscribeOn(Schedulers.boundedElastic())
                .map(body -> ResponseEntity.status(HttpStatus.CREATED).body(body));
    }

    @GetMapping("/{id}")
    public Mono<PatientSessionResponse> get(
            @PathVariable String id,
            @RequestHeader(name = "x-session-token", required = false) String token) {
        return Mono.fromCallable(() -> service.get(id, token))
                .subscribeOn(Schedulers.boundedElastic());
    }

    public record CreatePatientSessionRequest(String conversationLanguage) {}
}

