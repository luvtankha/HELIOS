import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DoctorProofService } from "../src/security/doctor-proof.js";

const javaUrl = process.env.HELIOS_PATIENT_TEST_URL;
const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = describe.skipIf(!javaUrl || !databaseUrl);
let db: PrismaClient;
let doctorId: string;
let patientId: string | undefined;
let sessionId: string | undefined;

suite(
  "native voice structured turn → Java → PostgreSQL → doctor dashboard",
  () => {
    beforeAll(async () => {
      if (
        !javaUrl?.startsWith("http://127.0.0.1:") ||
        !databaseUrl?.includes("/helios_test")
      )
        throw new Error("Local isolated test services required");
      db = new PrismaClient({ datasourceUrl: databaseUrl });
      const doctor = await db.user.create({
        data: {
          displayName: "Synthetic Handoff Doctor",
          role: "DOCTOR",
          specializationId: "internal-medicine",
          acceptingRouting: true,
        },
      });
      doctorId = doctor.id;
    });
    afterAll(async () => {
      if (!db) return;
      if (sessionId)
        await db.patientSession.deleteMany({ where: { id: sessionId } });
      if (patientId) {
        await db.clinicalBrief.deleteMany({ where: { patientId } });
        await db.comparison.deleteMany({ where: { patientId } });
        await db.patientSnapshot.deleteMany({ where: { patientId } });
        await db.timelineEvent.deleteMany({ where: { patientId } });
        await db.doctorPatientAssignment.deleteMany({ where: { patientId } });
        await db.auditLog.deleteMany({ where: { entityId: patientId } });
        await db.visit.deleteMany({ where: { patientId } });
        await db.patientProfile.deleteMany({ where: { id: patientId } });
      }
      if (doctorId) await db.user.deleteMany({ where: { id: doctorId } });
      await db.$disconnect();
    });

    it("captures symptoms first, logs one turn, routes and exposes facts only to the assigned doctor", async () => {
      async function post(
        path: string,
        body: unknown,
        proof?: string,
        internal = false,
      ) {
        const response = await fetch(`${javaUrl}${path}`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(proof ? { "x-session-token": proof } : {}),
            ...(internal
              ? {
                  Authorization: `Bearer ${process.env.HELIOS_VOICE_CONTROL_SECRET}`,
                }
              : {}),
          },
          body: JSON.stringify(body),
        });
        const result = await response.json();
        expect(response.ok, JSON.stringify(result)).toBe(true);
        return result;
      }
      const session = await post("/api/v2/patient-sessions", {
        conversationLanguage: "hi-Hinglish",
      });
      sessionId = session.sessionId;
      await post(
        "/api/v2/consents",
        {
          sessionId,
          consentType: "PRE_CONSULTATION",
          accepted: true,
          version: "v1",
        },
        session.sessionToken,
      );
      await post(
        "/api/v2/voice-sessions",
        {
          patientSessionId: sessionId,
          capabilities: { languageMode: "hi-Hinglish", bargeIn: true },
        },
        session.sessionToken,
      );
      const provenance = {
        source: "PATIENT_REPORTED",
        evidenceTurnIds: ["synthetic-turn-1"],
        model: "synthetic-native-audio-test",
        modelVersion: "test",
        conversationPolicyVersion: "test",
        confidence: "HIGH",
      };
      const first = await post(
        "/internal/v2/voice-runtime/turn",
        {
          patientSessionId: sessionId,
          facts: [
            {
              ...provenance,
              field: "chiefComplaint",
              value: "fatigue",
              state: "KNOWN",
            },
          ],
        },
        undefined,
        true,
      );
      expect(first.identityComplete).toBe(false);
      expect(
        await db.heliosIntakeFact.count({
          where: { patientSessionId: sessionId },
        }),
      ).toBe(1);
      await post(
        "/internal/v2/voice-runtime/turn",
        {
          patientSessionId: sessionId,
          identity: [
            { ...provenance, field: "fullName", value: "Synthetic Patient" },
            { ...provenance, field: "age", value: "32" },
            { ...provenance, field: "sex", value: "OTHER" },
          ],
        },
        undefined,
        true,
      );
      const linked = await db.patientSession.findUniqueOrThrow({
        where: { id: sessionId },
      });
      patientId = linked.patientId!;
      const complete = await post(
        "/internal/v2/voice-runtime/turn",
        {
          patientSessionId: sessionId,
          facts: [
            {
              ...provenance,
              field: "onset",
              value: "two days",
              state: "KNOWN",
            },
            { ...provenance, field: "severity", value: "3/10", state: "KNOWN" },
            {
              ...provenance,
              field: "pattern",
              value: "intermittent",
              state: "KNOWN",
            },
            {
              ...provenance,
              field: "associatedSymptoms",
              value: "none reported",
              state: "KNOWN",
            },
          ],
        },
        undefined,
        true,
      );
      expect(complete).toMatchObject({
        complete: true,
        assigned: true,
        specialization: "internal-medicine",
      });
      const visit = await db.visit.findUniqueOrThrow({
        where: { id: linked.visitId! },
      });
      expect(visit.preferredDoctorId).toBe(doctorId);
      expect(visit.status).toBe("READY_FOR_DOCTOR");
      const proof = new DoctorProofService().create(doctorId);
      const workspaceResponse = await fetch(
        `${process.env.HELIOS_DOCTOR_TEST_URL}/api/v1/doctor/patients/${patientId}/workspace?visitId=${visit.id}`,
        { headers: { "x-doctor-token": proof } },
      );
      expect(workspaceResponse.ok).toBe(true);
      const { data } = await workspaceResponse.json();
      expect(data.liveIntake.facts).toHaveLength(5);
      expect(data.visit.chiefComplaint).toBe("fatigue");
      expect(data.routing.specialization).toBe("internal-medicine");
      const queueResponse = await fetch(
        `${process.env.HELIOS_DOCTOR_TEST_URL}/api/v1/doctor/dashboard`,
        { headers: { "x-doctor-token": proof } },
      );
      const queue = await queueResponse.json();
      expect(JSON.stringify(queue.data)).toContain("fatigue");
    }, 30000);
  },
);
