package com.helios.patient.routing;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.helios.patient.common.id.CuidGenerator;
import com.helios.patient.intake.IntakeFact;
import com.helios.patient.intake.IntakeSessionService.IntakeSessionResponse;
import com.helios.patient.intake.IntakeSnapshot;
import com.helios.patient.patient.PatientProfileRepository;
import com.helios.patient.patient.session.PatientSessionEntity;
import com.helios.patient.visit.VisitEntity;
import tools.jackson.databind.json.JsonMapper;

/** Saves the routing evidence and grants the selected clinician dashboard access. */
@Service
public class IntakeHandoffService {
    private final SpecializationRoutingEngine engine;
    private final IntakeRoutingAdapter adapter;
    private final PatientProfileRepository patients;
    private final JdbcTemplate jdbc;
    private final JsonMapper json;
    private final CuidGenerator ids;

    public IntakeHandoffService(SpecializationRoutingEngine engine, IntakeRoutingAdapter adapter,
            PatientProfileRepository patients, JdbcTemplate jdbc, JsonMapper json, CuidGenerator ids) {
        this.engine = engine;
        this.adapter = adapter;
        this.patients = patients;
        this.jdbc = jdbc;
        this.json = json;
        this.ids = ids;
    }

    @Transactional
    public Handoff handoff(PatientSessionEntity session, VisitEntity visit, IntakeSessionResponse intake) {
        var patient = patients.findById(session.getPatientId()).orElseThrow();
        var input = adapter.fromValidatedIntake(snapshot(intake), patient.getAge());
        var result = engine.route(input);
        String inputJson = json.writeValueAsString(input);
        String resultJson = json.writeValueAsString(result);
        return persist(session, visit, patient.getId(), inputJson, resultJson, result);
    }

    public boolean emergency(IntakeSessionResponse intake) {
        return engine.route(adapter.fromValidatedIntake(snapshot(intake), null)).emergencyEscalation();
    }

    private static IntakeSnapshot snapshot(IntakeSessionResponse intake) {
        Map<String, IntakeFact> facts = new LinkedHashMap<>();
        intake.facts().forEach(fact -> facts.put(fact.field(), new IntakeFact(
                fact.field(), fact.knowledgeState(), fact.value(), fact.confidence(), fact.evidenceTurnIds())));
        String complaint = facts.containsKey("chiefComplaint") ? facts.get("chiefComplaint").value() : null;
        return new IntakeSnapshot(complaint, facts, List.of(), intake.completedTurns());
    }

    private Handoff persist(PatientSessionEntity session, VisitEntity visit, String patientId,
            String inputJson, String resultJson, RoutingResult result) {
        jdbc.update("""
                INSERT INTO "RoutingDecision" ("id", "sessionId", "visitId", "inputHash", "input", "result", "datasetVersion", "createdAt")
                VALUES (?, ?, ?, ?, CAST(? AS jsonb), CAST(? AS jsonb), ?, CURRENT_TIMESTAMP)
                """, ids.next(), session.getId(), visit.getId(), hash(inputJson), inputJson, resultJson, result.version());
        List<String> doctors = jdbc.queryForList("""
                SELECT u."id" FROM "User" u JOIN "Specialization" s ON s."id" = u."specializationId"
                WHERE u."role" = 'DOCTOR' AND u."status" = 'ACTIVE' AND u."acceptingRouting" = true
                AND s."active" = true AND s."id" = ?
                ORDER BY (SELECT count(*) FROM "Visit" v WHERE v."preferredDoctorId" = u."id"
                    AND v."status" IN ('WAITING','IN_PROGRESS','READY_FOR_DOCTOR','UNDER_REVIEW')), u."id"
                LIMIT 1
                """, String.class, result.primarySpecialization());
        String doctorId = doctors.isEmpty() ? null : doctors.getFirst();
        if (doctorId != null) {
            visit.assignPreferredDoctor(doctorId);
            jdbc.update("""
                    INSERT INTO "DoctorPatientAssignment" ("id", "doctorId", "patientId", "active", "createdAt")
                    VALUES (?, ?, ?, true, CURRENT_TIMESTAMP)
                    ON CONFLICT ("doctorId", "patientId") DO UPDATE SET "active" = true
                    """, ids.next(), doctorId, patientId);
        }
        return new Handoff(result.primarySpecialization(), doctorId, result.emergencyEscalation());
    }

    private static String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    public record Handoff(String specialization, String doctorId, boolean emergency) {}
}
