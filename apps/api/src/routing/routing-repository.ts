import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { RoutingAssessmentDto } from "@helios/shared";
import { AppError } from "../utils/app-error.js";
import { mappingSchema, type RoutingInput } from "./contracts.js";
import { routingDataset, routingDatasetHash } from "./routing-dataset.js";
import { routeSpecialization } from "./routing-engine.js";

type Db = PrismaClient | Prisma.TransactionClient;
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const strings = (value: unknown): string[] => typeof value === "string" ? [value] : Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
export class RoutingRepository {
  constructor(readonly db: Db) {}
  async context(sessionId: string) {
    const session = await this.db.patientSession.findUnique({
      where: { id: sessionId },
      include: {
        patient: true,
        visit: {
          include: {
            clinicalHistory: true,
            interview: true,
            riskSignals: {
              where: {
                status: { in: ["OPEN", "ACKNOWLEDGED"] },
                severity: "HIGH",
                category: { not: "FUTURE_DEMO_ONLY" },
              },
            },
          },
        },
      },
    });
    if (!session?.patient || !session.visit) throw new AppError("Complete patient details before department routing.",409,"ROUTING_INTAKE_REQUIRED");
    const state = record(session.visit.interview?.state);
    const facts = record(state.facts);
    const positive = (key: string) => { const fact = record(facts[key]); return fact.state === "YES" ? strings(fact.value) : []; };
    // Never use generated diagnosis labels, unreviewed document text or doctor-only notes.
    const complaintFact = record(facts.chiefComplaint);
    const rawComplaint = strings(complaintFact.rawAnswers)[0];
    const input: RoutingInput = {
      complaint: session.visit.clinicalHistory?.chiefComplaint || rawComplaint || "",
      symptoms: positive("associatedSymptoms"), knownConditions: positive("medicalHistory"), injury: positive("injury").join("; "),
      age: session.patient.age, sex: session.patient.sex, duration: positive("duration").join("; "), severity: positive("severity").join("; "),
      clinicalContext: { anatomicalLocation: positive("location").join("; "), pregnant: positive("pregnancy").some(v => /yes|pregnant/i.test(v)), currentEmergencySignal: session.visit.riskSignals.length > 0 },
    };
    // Numeric severity remains meaningful without converting arbitrary objects into symptoms.
    const severity = record(facts.severity);
    if (severity.state === "YES" && typeof severity.value === "number") input.severity = String(severity.value);
    return { session, input };
  }
  async assess(sessionId: string): Promise<RoutingAssessmentDto> {
    const { session,input } = await this.context(sessionId);
    const rows = await this.db.medicalConditionSpecialization.findMany({ where:{active:true},orderBy:{id:"asc"} });
    if (!rows.length) throw new AppError("Department routing is not configured. Please contact clinic staff.",503,"ROUTING_DATA_UNAVAILABLE");
    const mappings = rows.map(row=>mappingSchema.parse(row.definition));
    const version = `${routingDataset.version}:${createHash("sha256").update(JSON.stringify([routingDatasetHash,rows.map(row=>[row.id,row.definition,row.datasetVersion])])).digest("hex").slice(0,16)}`;
    const result = routeSpecialization(input,mappings,routingDataset.emergencyRules,version);
    const inputHash = createHash("sha256").update(JSON.stringify([input,version])).digest("hex");
    const latest = await this.db.routingDecision.findFirst({where:{sessionId},orderBy:[{createdAt:"desc"},{id:"desc"}]});
    const decision = latest?.inputHash === inputHash ? latest : await this.db.routingDecision.create({data:{sessionId,visitId:session.visit!.id,inputHash,input: input as Prisma.InputJsonObject,result: {...result},datasetVersion:version}});
    const specializations = await this.db.specialization.findMany({where:{active:true,id:{not:"unclassified"}},select:{id:true,displayName:true,providerType:true},orderBy:{displayName:"asc"}});
    return {decisionId:decision.id,createdAt:decision.createdAt.toISOString(),recommendation:result,specializations,selectedProviderId:session.visit!.preferredDoctorId,reviewStatus:"CLINICIAN_REVIEW_REQUIRED"};
  }
  async providers(specializationId?: string) {
    const specialization = specializationId ? await this.db.specialization.findFirst({where:{active:true,OR:[{id:specializationId},{aliases:{has:specializationId.toLowerCase()}}]}}) : null;
    if (specializationId && !specialization) throw new AppError("Unknown department.",400,"SPECIALIZATION_INVALID");
    const providers = await this.db.user.findMany({where:{role:"DOCTOR",status:"ACTIVE",specialization:{active:true},...(specialization ? {specializationId:specialization.id}: {})},select:{id:true,displayName:true,acceptingRouting:true,specialization:{select:{id:true,displayName:true,providerType:true}}},orderBy:[{displayName:"asc"},{id:"asc"}],take:100});
    return {providers, specializationId:specialization?.id ?? null,availabilityNote:"Availability means the clinic has enabled routing requests, not a booked appointment or guaranteed time slot. Unverified specialties cannot receive routed requests."};
  }
}
