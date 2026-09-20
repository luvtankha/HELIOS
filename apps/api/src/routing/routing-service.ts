import type { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";
import { sessionProof } from "../security/session-proof.js";
import { DoctorProofService } from "../security/doctor-proof.js";
import { AppError } from "../utils/app-error.js";
import { RoutingRepository } from "./routing-repository.js";

export class RoutingService {
  constructor(private readonly db: PrismaClient, private readonly enabled = env.ENABLE_SPECIALIZATION_ROUTING) {}
  private session(token?: string) {
    const id = sessionProof.verify(token);
    if (!this.enabled) throw new AppError("Department routing is not enabled.",503,"ROUTING_DISABLED");
    return id;
  }
  async assess(token?: string) { return new RoutingRepository(this.db).assess(this.session(token)); }
  async providers(token?: string, specializationId?: string) {
    const id = this.session(token);
    const repo = new RoutingRepository(this.db);
    await repo.context(id);
    return repo.providers(specializationId);
  }
  async select(token: string | undefined, providerId: string | null) {
    const sessionId = this.session(token);
    return this.db.$transaction(async tx => {
      const repo = new RoutingRepository(tx);
      const assessment = await repo.assess(sessionId);
      if (assessment.recommendation.emergencyEscalation) throw new AppError(assessment.recommendation.reason,409,"ROUTING_EMERGENCY");
      const {session} = await repo.context(sessionId);
      if (session.status === "COMPLETED") throw new AppError("Intake is already submitted. Contact clinic staff to change your doctor.",409,"ROUTING_ALREADY_SUBMITTED");
      if (providerId) {
        const provider = await tx.user.findFirst({where:{id:providerId,role:"DOCTOR",status:"ACTIVE",acceptingRouting:true,specializationId:{not:"unclassified"},specialization:{active:true}}});
        if (!provider) throw new AppError("This doctor is not currently accepting routing requests. Choose another doctor or contact the clinic.",409,"PROVIDER_UNAVAILABLE");
      }
      await tx.visit.update({where:{id:session.visitId!},data:{preferredDoctorId:providerId}});
      await tx.auditLog.create({data:{action:"ROUTING_PROVIDER_SELECTED",entityType:"Visit",entityId:session.visitId!,metadata:{providerId,decisionId:assessment.decisionId}}});
      return {selectedProviderId:providerId};
    });
  }
  async audit(visitId: string, token?: string) {
    const doctorId = new DoctorProofService().verify(token);
    const doctor = await this.db.user.findFirst({where:{id:doctorId,status:"ACTIVE",role:{in:["DOCTOR","ADMIN"]}}});
    const visit = await this.db.visit.findUnique({where:{id:visitId},select:{patientId:true}});
    if (!doctor || !visit || (doctor.role !== "ADMIN" && !await this.db.doctorPatientAssignment.findFirst({where:{doctorId,patientId:visit.patientId,active:true}}))) throw new AppError("Routing audit access denied.",403,"ROUTING_AUDIT_FORBIDDEN");
    return this.db.routingDecision.findMany({where:{visitId},orderBy:{createdAt:"desc"},take:20});
  }
}
