package com.helios.patient.intake;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.helios.patient.common.id.CuidGenerator;
import com.helios.patient.patient.session.PatientSessionRepository;
import com.helios.patient.patient.session.PatientSessionService;
import com.helios.patient.patient.session.PatientFlowStep;

@Service
public class IntakeSessionService {

    private final IntakeFactRepository facts;
    private final PatientSessionRepository patientSessionRepository;
    private final PatientSessionService patientSessions;
    private final ClinicalFactValidator validator;
    private final FollowUpPolicyEngine followUpPolicy;
    private final CuidGenerator ids;

    public IntakeSessionService(
            IntakeFactRepository facts,
            PatientSessionRepository patientSessionRepository,
            PatientSessionService patientSessions,
            ClinicalFactValidator validator,
            FollowUpPolicyEngine followUpPolicy,
            CuidGenerator ids) {
        this.facts = facts;
        this.patientSessionRepository = patientSessionRepository;
        this.patientSessions = patientSessions;
        this.validator = validator;
        this.followUpPolicy = followUpPolicy;
        this.ids = ids;
    }

    @Transactional
    public IntakeFactResponse acceptRuntimeCandidate(
            String patientSessionId,
            ClinicalFactCandidate candidate) {
        if (patientSessionId == null || patientSessionId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "patientSessionId is required");
        }
        var patientSession = patientSessionRepository.findByIdForUpdate(patientSessionId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "patient session not found"));
        if ((patientSession.getPatientId() == null || patientSession.getVisitId() == null)
                && patientSession.getCurrentStep() != PatientFlowStep.BASIC_INFO) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "patient identity must be completed before clinical intake");
        }
        if (patientSession.getCurrentStep() != PatientFlowStep.BASIC_INFO
                && patientSession.getCurrentStep() != PatientFlowStep.CHIEF_COMPLAINT
                && patientSession.getCurrentStep() != PatientFlowStep.INTERVIEW) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "clinical intake is not active");
        }
        IntakeFact validated = validator.validate(candidate);
        IntakeFactEntity entity = facts
                .findByPatientSessionIdAndField(patientSessionId, validated.field())
                .orElseGet(() -> new IntakeFactEntity(ids.next(), patientSessionId, candidate));
        entity.apply(candidate);
        IntakeFactResponse response = IntakeFactResponse.from(facts.save(entity));
        if ("chiefComplaint".equals(validated.field())
                && validated.state() == KnowledgeState.KNOWN
                && patientSession.getPatientId() != null && patientSession.getVisitId() != null) {
            patientSession.beginInterview();
            patientSessionRepository.save(patientSession);
        }
        return response;
    }

    @Transactional(readOnly = true)
    public IntakeSessionResponse get(String patientSessionId, String patientSessionProof) {
        patientSessions.get(patientSessionId, patientSessionProof);
        return response(patientSessionId);
    }

    @Transactional(readOnly = true)
    public IntakeSessionResponse internalSnapshot(String patientSessionId) {
        if (!patientSessionRepository.existsById(patientSessionId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "patient session not found");
        }
        return response(patientSessionId);
    }

    @Transactional
    public void requireActiveRuntime(String patientSessionId) {
        if (patientSessionId == null || patientSessionId.isBlank()) throw new IllegalArgumentException("patient session is required");
        var session = patientSessionRepository.findByIdForUpdate(patientSessionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "patient session not found"));
        if (session.getCurrentStep() != PatientFlowStep.BASIC_INFO
                && session.getCurrentStep() != PatientFlowStep.CHIEF_COMPLAINT
                && session.getCurrentStep() != PatientFlowStep.INTERVIEW) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "patient intake is not active");
        }
    }

    private IntakeSessionResponse response(String patientSessionId) {
        List<IntakeFactEntity> entities = facts.findByPatientSessionIdOrderByUpdatedAtAsc(patientSessionId);
        Map<String, IntakeFact> factMap = new LinkedHashMap<>();
        var evidenceTurns = new LinkedHashSet<String>();
        entities.forEach(entity -> {
            factMap.put(entity.getField(), entity.toFact());
            evidenceTurns.addAll(entity.getEvidenceTurnIds());
        });
        String complaint = factMap.containsKey("chiefComplaint")
                ? factMap.get("chiefComplaint").value()
                : null;
        IntakeSnapshot snapshot = new IntakeSnapshot(
                complaint,
                Map.copyOf(factMap),
                List.of(),
                evidenceTurns.size());
        FollowUpDecision decision = followUpPolicy.next(snapshot);
        return new IntakeSessionResponse(
                patientSessionId,
                entities.stream().map(IntakeFactResponse::from).toList(),
                decision.complete(),
                decision.nextIntent(),
                decision.reason(),
                evidenceTurns.size());
    }

    public record IntakeFactResponse(
            String factId,
            String field,
            KnowledgeState knowledgeState,
            String value,
            String confidence,
            String source,
            List<String> evidenceTurnIds,
            String model,
            String modelVersion,
            String conversationPolicyVersion) {
        static IntakeFactResponse from(IntakeFactEntity entity) {
            return new IntakeFactResponse(
                    entity.getId(),
                    entity.getField(),
                    entity.getKnowledgeState(),
                    entity.getValue(),
                    entity.getConfidence(),
                    entity.getSource(),
                    entity.getEvidenceTurnIds(),
                    entity.getModel(),
                    entity.getModelVersion(),
                    entity.getConversationPolicyVersion());
        }
    }

    public record IntakeSessionResponse(
            String patientSessionId,
            List<IntakeFactResponse> facts,
            boolean complete,
            FollowUpIntent nextIntent,
            String decisionReason,
            int completedTurns) {}
}
