package com.helios.patient.patient.identity;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.helios.patient.common.id.CuidGenerator;
import com.helios.patient.patient.PatientProfileEntity;
import com.helios.patient.patient.PatientProfileRepository;
import com.helios.patient.patient.PatientSex;
import com.helios.patient.patient.session.PatientSessionEntity;
import com.helios.patient.patient.session.PatientSessionRepository;
import com.helios.patient.patient.session.PatientFlowStep;
import com.helios.patient.visit.VisitEntity;
import com.helios.patient.visit.VisitRepository;

@Service
public class PatientIdentityService {

    private final PatientSessionRepository sessions;
    private final PatientProfileRepository patients;
    private final VisitRepository visits;
    private final IdentityCandidateValidator validator;
    private final CuidGenerator ids;

    public PatientIdentityService(
            PatientSessionRepository sessions,
            PatientProfileRepository patients,
            VisitRepository visits,
            IdentityCandidateValidator validator,
            CuidGenerator ids) {
        this.sessions = sessions;
        this.patients = patients;
        this.visits = visits;
        this.validator = validator;
        this.ids = ids;
    }

    @Transactional
    public IdentityProgress accept(String patientSessionId, IdentityCandidate candidate) {
        return acceptBatch(patientSessionId, java.util.List.of(candidate));
    }

    @Transactional
    public IdentityProgress acceptBatch(String patientSessionId, java.util.List<IdentityCandidate> candidates) {
        if (patientSessionId == null || patientSessionId.isBlank() || candidates == null || candidates.size() > 4) {
            throw new IllegalArgumentException("invalid identity turn");
        }
        var fields = candidates.stream().map(validator::validate).toList();
        if (fields.stream().map(IdentityCandidateValidator.ValidatedIdentityField::field).distinct().count() != fields.size()) {
            throw new IllegalArgumentException("duplicate identity field in turn");
        }
        PatientSessionEntity session = sessions.findByIdForUpdate(patientSessionId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "patient session not found"));
        if (session.getCurrentStep() == PatientFlowStep.CONSENT) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "patient consent is required before identity capture");
        }
        if (session.getPatientId() != null || session.getVisitId() != null) {
            if (fields.stream().allMatch(field -> java.util.Objects.equals(session.identityValue(field.field()), field.value()))) {
                return progress(session);
            }
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "patient identity is already materialized");
        }
        if (session.getCurrentStep() != PatientFlowStep.BASIC_INFO) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "patient identity capture is not active");
        }
        fields.forEach(field -> session.recordIdentityField(field.field(), field.value()));

        if (session.hasRequiredIdentity() && session.getPatientId() == null) {
            materialize(session);
        }
        sessions.save(session);
        return progress(session);
    }

    @Transactional(readOnly = true)
    public IdentityProgress progress(String patientSessionId) {
        PatientSessionEntity session = sessions.findById(patientSessionId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "patient session not found"));
        return progress(session);
    }

    private void materialize(PatientSessionEntity session) {
        String patientId = ids.next();
        String visitId = ids.next();
        String phone = session.identityValue("phone");
        PatientProfileEntity patient = new PatientProfileEntity(
                patientId,
                "HV2-" + patientId,
                session.identityValue("fullName"),
                Integer.parseInt(session.identityValue("age")),
                PatientSex.valueOf(session.identityValue("sex")),
                session.getLanguage(),
                phone == null || phone.isBlank() ? null : phone);
        patients.save(patient);
        visits.save(new VisitEntity(visitId, patientId));
        session.linkPatientVisit(patientId, visitId);
    }

    private static IdentityProgress progress(PatientSessionEntity session) {
        String nextField = nextMissing(session);
        return new IdentityProgress(
                session.getId(),
                session.getPatientId() != null && session.getVisitId() != null,
                nextField,
                session.getPatientId(),
                session.getVisitId());
    }

    private static String nextMissing(PatientSessionEntity session) {
        if (blank(session.identityValue("fullName"))) return "fullName";
        if (blank(session.identityValue("age"))) return "age";
        if (blank(session.identityValue("sex"))) return "sex";
        return null;
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    public record IdentityProgress(
            String patientSessionId,
            boolean materialized,
            String nextField,
            String patientId,
            String visitId) {}
}
