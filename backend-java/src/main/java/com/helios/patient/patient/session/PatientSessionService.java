package com.helios.patient.patient.session;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.helios.patient.common.id.CuidGenerator;
import com.helios.patient.security.SessionProofCodec;

@Service
public class PatientSessionService {

    public static final String LANGUAGE_MODE = "hi-Hinglish";

    private final PatientSessionRepository repository;
    private final CuidGenerator ids;
    private final SessionProofCodec proofCodec;

    public PatientSessionService(
            PatientSessionRepository repository,
            CuidGenerator ids,
            SessionProofCodec proofCodec) {
        this.repository = repository;
        this.ids = ids;
        this.proofCodec = proofCodec;
    }

    @Transactional
    public PatientSessionResponse create(String requestedLanguage) {
        if (requestedLanguage != null && !LANGUAGE_MODE.equals(requestedLanguage)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "HELIOS v2 supports Hindi/Hinglish conversation");
        }
        PatientSessionEntity entity = repository.save(PatientSessionEntity.create(ids.next(), LANGUAGE_MODE));
        return PatientSessionResponse.from(entity, proofCodec.create(entity.getId()));
    }

    @Transactional(readOnly = true)
    public PatientSessionResponse get(String id, String token) {
        verifyAccess(id, token);
        PatientSessionEntity entity = repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "patient session not found"));
        return PatientSessionResponse.from(entity, null);
    }

    @Transactional
    public PatientSessionResponse getForUpdate(String id, String token) {
        verifyAccess(id, token);
        PatientSessionEntity entity = repository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "patient session not found"));
        return PatientSessionResponse.from(entity, null);
    }

    private void verifyAccess(String id, String token) {
        var verification = proofCodec.verify(token);
        if (verification.missing()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "patient session proof required");
        }
        if (!verification.valid() || verification.expired() || !id.equals(verification.subject())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "patient session access denied");
        }
    }

    @Transactional
    public PatientSessionResponse recordConsent(String id, String token, boolean accepted) {
        verifyAccess(id, token);
        PatientSessionEntity entity = repository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "patient session not found"));
        entity.recordConsent(accepted);
        return PatientSessionResponse.from(repository.save(entity), null);
    }
}
