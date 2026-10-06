package com.helios.patient.consent;

import java.time.LocalDateTime;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.helios.patient.common.id.CuidGenerator;
import com.helios.patient.patient.session.PatientSessionService;

@Service
public class ConsentService {
    private final ConsentRecordRepository repository;
    private final PatientSessionService patientSessions;
    private final CuidGenerator ids;

    public ConsentService(
            ConsentRecordRepository repository,
            PatientSessionService patientSessions,
            CuidGenerator ids) {
        this.repository = repository;
        this.patientSessions = patientSessions;
        this.ids = ids;
    }

    @Transactional
    public ConsentResponse record(
            String sessionId,
            String consentType,
            boolean accepted,
            String version,
            String sessionProof) {
        if (sessionId == null || sessionId.isBlank() || consentType == null || consentType.isBlank()
                || version == null || version.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "sessionId, consentType and version are required");
        }
        patientSessions.getForUpdate(sessionId, sessionProof);
        var existing = repository.findBySessionIdAndConsentTypeAndVersion(sessionId, consentType, version);
        if (existing.isPresent()) {
            if (existing.get().isAccepted() != accepted) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "consent record already exists with a different value");
            }
            return ConsentResponse.from(existing.get());
        }

        ConsentRecordEntity saved = repository.save(
                new ConsentRecordEntity(ids.next(), sessionId, consentType, accepted, version));
        patientSessions.recordConsent(sessionId, sessionProof, accepted);
        return ConsentResponse.from(saved);
    }

    public record ConsentResponse(
            String consentId,
            String sessionId,
            String consentType,
            boolean accepted,
            String version,
            LocalDateTime acceptedAt) {
        static ConsentResponse from(ConsentRecordEntity entity) {
            return new ConsentResponse(
                    entity.getId(), entity.getSessionId(), entity.getConsentType(), entity.isAccepted(),
                    entity.getVersion(), entity.getAcceptedAt());
        }
    }
}
