import type { TimelineRepository } from "../repositories/timeline-repository.js";

export class TimelineAuditService {
  constructor(private readonly repository: TimelineRepository) {}

  async viewed(patientId: string, requestId?: string) {
    await this.repository.audit({
      action: "TIMELINE_VIEWED",
      entityId: patientId,
      ...(requestId && { requestId }),
    });
  }

  async rebuilt(patientId: string, count: number, requestId?: string) {
    await this.repository.audit({
      action: "TIMELINE_REBUILT",
      entityId: patientId,
      metadata: { projectedEventCount: count },
      ...(requestId && { requestId }),
    });
  }
}
