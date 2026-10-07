import type { PatientQueueStatusDto } from "@helios/shared";
import { Prisma, type QueueStatus } from "@prisma/client";
import {
  sessionProof,
  type SessionProofService,
} from "../security/session-proof.js";
import { AppError } from "../utils/app-error.js";
import {
  InAppQueueNotificationProvider,
  type QueueNotificationProvider,
} from "./notification-provider.js";
import type { QueueRepository, QueueRow } from "./queue-repository.js";
const DEFAULT_QUEUE = "A";
const AVERAGE_CONSULTATION_MINUTES = 6;
const MAX_RETRIES = 3;
export interface QueueOperations {
  checkIn(sessionToken?: string): Promise<PatientQueueStatusDto>;
  patientStatus(sessionToken?: string): Promise<PatientQueueStatusDto>;
}
export class QueueService implements QueueOperations {
  constructor(
    private readonly repository: QueueRepository,
    private readonly patientProof: SessionProofService = sessionProof,
    private readonly notifications: QueueNotificationProvider = new InAppQueueNotificationProvider(),
  ) {}
  async checkIn(sessionToken?: string) {
    const sessionId = this.patientProof.verify(sessionToken);
    const date = queueDate();
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const result = await this.repository.checkIn(
          sessionId,
          DEFAULT_QUEUE,
          date,
          DEFAULT_QUEUE,
        );
        if (result.kind === "INCOMPLETE")
          throw new AppError(
            "Complete the required intake before check-in",
            400,
            "INTAKE_INCOMPLETE",
          );
        const status = await this.patientStatus(sessionToken);
        await this.notify(status.tokenId, status.tokenNumber, status.status);
        return status;
      } catch (error) {
        if (!retryable(error) || attempt === MAX_RETRIES - 1) throw error;
        const existing = await this.repository.bySession(sessionId);
        if (existing) return this.patientStatus(sessionToken);
      }
    }
    throw new AppError(
      "Check-in could not be completed",
      409,
      "CHECK_IN_CONFLICT",
    );
  }
  async patientStatus(sessionToken?: string) {
    const sessionId = this.patientProof.verify(sessionToken);
    const own = await this.repository.bySession(sessionId);
    if (!own)
      throw new AppError(
        "No checked-in token is available",
        404,
        "TOKEN_NOT_FOUND",
      );
    const [entries, control] = await Promise.all([
      this.repository.queue(own.queueKey, own.queueDate),
      this.repository.counter(own.queueKey, own.queueDate),
    ]);
    const waiting = orderedWaiting(entries);
    const index = waiting.findIndex((row) => row.id === own.id);
    const ahead = index < 0 ? 0 : index;
    const serving = entries
      .filter(
        (row) => row.status === "CALLED" || row.status === "IN_CONSULTATION",
      )
      .sort(
        (a, b) => (b.calledAt?.getTime() ?? 0) - (a.calledAt?.getTime() ?? 0),
      )[0];
    return {
      tokenId: own.id,
      tokenNumber: own.tokenNumber,
      status: own.status,
      patientsAhead: ahead,
      position: index < 0 ? null : index + 1,
      estimatedWaitMinutes:
        own.status === "WAITING" ? ahead * AVERAGE_CONSULTATION_MINUTES : null,
      estimateLabel:
        own.status === "WAITING"
          ? `~${ahead * AVERAGE_CONSULTATION_MINUTES} min`
          : "Not applicable",
      ...(serving && { currentToken: serving.tokenNumber }),
      queuePaused: control?.paused ?? false,
      updatedAt: new Date().toISOString(),
      refreshAfterSeconds: 8,
    } satisfies PatientQueueStatusDto;
  }
  private async notify(
    tokenId: string,
    tokenNumber: string,
    status: QueueStatus,
  ) {
    try {
      await this.notifications.publish({
        tokenId,
        tokenNumber,
        status,
        occurredAt: new Date().toISOString(),
      });
    } catch {
      // Notification delivery is best-effort; persisted queue state remains authoritative.
    }
  }
}
function queueDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return new Date(`${value.year}-${value.month}-${value.day}T00:00:00.000Z`);
}
function orderedWaiting(rows: QueueRow[]) {
  return rows.filter((row) => row.status === "WAITING").sort(order);
}
function order(a: QueueRow, b: QueueRow) {
  const rank = (row: QueueRow) => (row.priority === "PRIORITY_REVIEW" ? 0 : 1);
  return (
    rank(a) - rank(b) ||
    a.createdAt.getTime() - b.createdAt.getTime() ||
    a.id.localeCompare(b.id)
  );
}
function retryable(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    ["P2034", "P2002"].includes(error.code)
  );
}
