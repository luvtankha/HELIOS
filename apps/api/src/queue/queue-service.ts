import type {
  DoctorQueueDto,
  DoctorQueueEntryDto,
  PatientQueueStatusDto,
} from "@helios/shared";
import { Prisma, type QueueStatus } from "@prisma/client";
import { DoctorProofService } from "../security/doctor-proof.js";
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
const transitions: Record<QueueStatus, QueueStatus[]> = {
  WAITING: ["CALLED", "CANCELLED", "NO_SHOW", "SKIPPED"],
  CALLED: ["WAITING", "IN_CONSULTATION", "NO_SHOW", "SKIPPED"],
  IN_CONSULTATION: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
  SKIPPED: [],
};
const actions: Record<string, { status: QueueStatus; event: string }> = {
  call: { status: "CALLED", event: "TOKEN_CALLED" },
  start: { status: "IN_CONSULTATION", event: "CONSULTATION_STARTED" },
  complete: { status: "COMPLETED", event: "TOKEN_COMPLETED" },
  skip: { status: "SKIPPED", event: "TOKEN_SKIPPED" },
  "no-show": { status: "NO_SHOW", event: "NO_SHOW_MARKED" },
  cancel: { status: "CANCELLED", event: "TOKEN_CANCELLED" },
  requeue: { status: "WAITING", event: "TOKEN_REQUEUED" },
};

export interface QueueOperations {
  checkIn(sessionToken?: string): Promise<PatientQueueStatusDto>;
  patientStatus(sessionToken?: string): Promise<PatientQueueStatusDto>;
  doctorQueue(doctorToken?: string): Promise<DoctorQueueDto>;
  callNext(
    doctorToken?: string,
    requestId?: string,
  ): Promise<DoctorQueueEntryDto>;
  act(
    tokenId: string,
    action: string,
    doctorToken?: string,
    requestId?: string,
  ): Promise<DoctorQueueEntryDto>;
  setPaused(
    paused: boolean,
    doctorToken?: string,
    requestId?: string,
  ): Promise<{ paused: boolean }>;
}

export class QueueService implements QueueOperations {
  constructor(
    private readonly repository: QueueRepository,
    private readonly patientProof: SessionProofService = sessionProof,
    private readonly doctorProof = new DoctorProofService(),
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

  async doctorQueue(doctorToken?: string) {
    const doctor = await this.authorizeDoctor(doctorToken);
    const date = queueDate();
    const [entries, counter] = await Promise.all([
      this.repository.queue(
        DEFAULT_QUEUE,
        date,
        doctor.role === "ADMIN" ? undefined : doctor.id,
      ),
      this.repository.counter(DEFAULT_QUEUE, date),
    ]);
    const sorted = [...entries].sort((a, b) => order(a, b));
    const current = entries.find((row) => row.status === "CALLED");
    return {
      queueKey: DEFAULT_QUEUE,
      queueDate: date.toISOString().slice(0, 10),
      paused: counter?.paused ?? false,
      ...(current && { currentToken: current.tokenNumber }),
      entries: sorted.map(doctorItem),
      counts: {
        waiting: entries.filter((row) => row.status === "WAITING").length,
        called: entries.filter((row) => row.status === "CALLED").length,
        inConsultation: entries.filter(
          (row) => row.status === "IN_CONSULTATION",
        ).length,
        completed: entries.filter((row) => row.status === "COMPLETED").length,
        priorityReview: entries.filter(
          (row) =>
            row.status === "WAITING" && row.priority === "PRIORITY_REVIEW",
        ).length,
      },
      updatedAt: new Date().toISOString(),
      refreshAfterSeconds: 8,
    } satisfies DoctorQueueDto;
  }

  async callNext(doctorToken?: string, requestId?: string) {
    const doctor = await this.authorizeDoctor(doctorToken);
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const queue = await this.doctorQueue(doctorToken);
      const allowed = queue.entries.map((item) => item.patientId);
      try {
        const result = await this.repository.callNext(
          DEFAULT_QUEUE,
          queueDate(),
          doctor.id,
          allowed,
          requestId,
        );
        if (result.kind === "PAUSED")
          throw new AppError("Queue is paused", 409, "QUEUE_PAUSED");
        if (result.kind === "EMPTY")
          throw new AppError(
            "No waiting token is available",
            404,
            "QUEUE_EMPTY",
          );
        if (result.kind === "RACE") continue;
        const item = doctorItem(result.row);
        await this.notify(item.id, item.tokenNumber, item.status);
        return item;
      } catch (error) {
        if (!retryable(error) || attempt === MAX_RETRIES - 1) throw error;
      }
    }
    throw new AppError(
      "Queue changed; refresh and try again",
      409,
      "QUEUE_CONFLICT",
    );
  }

  async act(
    tokenId: string,
    action: string,
    doctorToken?: string,
    requestId?: string,
  ) {
    const doctor = await this.authorizeDoctor(doctorToken);
    const row = await this.repository.byId(tokenId);
    if (
      !row ||
      !(await this.repository.assigned(
        doctor.id,
        row.patientId,
        doctor.role === "ADMIN",
      ))
    )
      throw new AppError(
        "Token access is not authorized",
        403,
        "TOKEN_FORBIDDEN",
      );
    if (["call", "recall"].includes(action)) {
      const control = await this.repository.counter(
        row.queueKey,
        row.queueDate,
      );
      if (control?.paused)
        throw new AppError("Queue is paused", 409, "QUEUE_PAUSED");
    }
    if (action === "recall") {
      if (row.status !== "CALLED")
        throw new AppError(
          "This token cannot be recalled",
          409,
          "QUEUE_TRANSITION_INVALID",
        );
      const recalled = await this.repository.recall(
        row.id,
        doctor.id,
        requestId,
      );
      if (!recalled)
        throw new AppError(
          "Queue changed; refresh and try again",
          409,
          "QUEUE_CONFLICT",
        );
      const item = doctorItem(recalled);
      await this.notify(item.id, item.tokenNumber, item.status);
      return item;
    }
    const target = actions[action];
    if (!target)
      throw new AppError(
        "Queue action is invalid",
        400,
        "QUEUE_ACTION_INVALID",
      );
    if (!transitions[row.status].includes(target.status))
      throw new AppError(
        "This token cannot move to that status",
        409,
        "QUEUE_TRANSITION_INVALID",
      );
    const changed = await this.repository.transition(
      row.id,
      row.status,
      target.status,
      target.event,
      doctor.id,
      doctor.role,
      requestId,
    );
    if (!changed)
      throw new AppError(
        "Queue changed; refresh and try again",
        409,
        "QUEUE_CONFLICT",
      );
    const item = doctorItem(changed);
    await this.notify(item.id, item.tokenNumber, item.status);
    return item;
  }

  async setPaused(paused: boolean, doctorToken?: string, requestId?: string) {
    const doctor = await this.authorizeDoctor(doctorToken);
    await this.repository.pause(
      DEFAULT_QUEUE,
      queueDate(),
      paused,
      doctor.id,
      requestId,
    );
    return { paused };
  }

  private async authorizeDoctor(token?: string) {
    const id = this.doctorProof.verify(token);
    const doctor = await this.repository.doctor(id);
    if (!doctor)
      throw new AppError(
        "Doctor access is not authorized",
        403,
        "DOCTOR_NOT_AUTHORIZED",
      );
    return doctor;
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
function doctorItem(row: QueueRow): DoctorQueueEntryDto {
  return {
    id: row.id,
    tokenNumber: row.tokenNumber,
    patientId: row.patientId,
    patientCode: row.patient.patientCode,
    patientName: row.patient.fullName,
    age: row.patient.age,
    ...(row.visit.clinicalHistory?.chiefComplaint && {
      chiefComplaint: row.visit.clinicalHistory.chiefComplaint,
    }),
    status: row.status,
    priority: row.priority,
    waitMinutes:
      row.status === "WAITING"
        ? Math.max(
            0,
            Math.floor((Date.now() - row.createdAt.getTime()) / 60_000),
          )
        : 0,
    createdAt: row.createdAt.toISOString(),
    ...(row.calledAt && { calledAt: row.calledAt.toISOString() }),
    ...(row.consultationStartedAt && {
      consultationStartedAt: row.consultationStartedAt.toISOString(),
    }),
    ...(row.completedAt && { completedAt: row.completedAt.toISOString() }),
  };
}
function retryable(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    ["P2034", "P2002"].includes(error.code)
  );
}
