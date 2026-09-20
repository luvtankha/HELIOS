import { describe, expect, it, vi } from "vitest";
import { QueueService } from "../../src/queue/queue-service.js";
import type {
  QueueRepository,
  QueueRow,
} from "../../src/queue/queue-repository.js";
import { SessionProofService } from "../../src/security/session-proof.js";
import { DoctorProofService } from "../../src/security/doctor-proof.js";

const secret = "phase-fourteen-unit-test-secret-long-enough";
const patientProof = new SessionProofService(secret);
const doctorProof = new DoctorProofService(secret);
const patientToken = patientProof.create("session-a");
const doctorToken = doctorProof.create("doctor-a");

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "token-a",
    queueKey: "A",
    queueDate: new Date("2026-09-14T00:00:00Z"),
    sequence: 2,
    tokenNumber: "A-002",
    patientId: "patient-a",
    visitId: "visit-a",
    doctorId: null,
    status: "WAITING",
    priority: "NORMAL",
    source: "PATIENT_INTAKE",
    createdAt: new Date(Date.now() - 12 * 60_000),
    calledAt: null,
    consultationStartedAt: null,
    completedAt: null,
    updatedAt: new Date(),
    patient: {
      id: "patient-a",
      patientCode: "SYNTHETIC-A",
      fullName: "Aarav Sharma",
      age: 24,
      sex: "MALE",
    },
    visit: {
      id: "visit-a",
      patientId: "patient-a",
      tokenNumber: "A-002",
      status: "READY_FOR_DOCTOR",
      visitType: "PRE_CONSULTATION",
      startedAt: new Date(),
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      clinicalHistory: { chiefComplaint: "Synthetic pain" },
    },
    ...overrides,
  } as unknown as QueueRow;
}

function harness(overrides: Record<string, unknown> = {}) {
  const own = row();
  const repository = {
    checkIn: vi.fn(async () => ({ kind: "EXISTING", row: own })),
    bySession: vi.fn(async (id: string) =>
      id === "session-a"
        ? own
        : id === "session-b"
          ? row({ id: "token-b", patientId: "patient-b", tokenNumber: "A-003" })
          : null,
    ),
    queue: vi.fn(async () => [
      row({
        id: "ahead",
        sequence: 1,
        tokenNumber: "A-001",
        createdAt: new Date(Date.now() - 20 * 60_000),
      }),
      own,
    ]),
    counter: vi.fn(async () => ({ paused: false })),
    doctor: vi.fn(async () => ({
      id: "doctor-a",
      role: "DOCTOR",
      displayName: "Dr Demo",
    })),
    assigned: vi.fn(async () => true),
    byId: vi.fn(async () => own),
    callNext: vi.fn(async () => ({
      kind: "CALLED",
      row: row({ status: "CALLED", calledAt: new Date() }),
    })),
    transition: vi.fn(async () =>
      row({ status: "CALLED", calledAt: new Date() }),
    ),
    recall: vi.fn(async () => row({ status: "CALLED", calledAt: new Date() })),
    pause: vi.fn(async () => ({ paused: true })),
    ...overrides,
  };
  return {
    repository,
    service: new QueueService(
      repository as unknown as QueueRepository,
      patientProof,
      doctorProof,
    ),
  };
}

describe("QueueService", () => {
  it("returns one existing token when the patient checks in twice", async () => {
    const { service, repository } = harness();
    const first = await service.checkIn(patientToken);
    const second = await service.checkIn(patientToken);
    expect(first.tokenId).toBe("token-a");
    expect(second.tokenId).toBe("token-a");
    expect(repository.checkIn).toHaveBeenCalledTimes(2);
  });

  it("calculates patient position and deterministic estimated wait on the backend", async () => {
    const { service } = harness();
    const result = await service.patientStatus(patientToken);
    expect(result).toMatchObject({
      tokenNumber: "A-002",
      patientsAhead: 1,
      position: 2,
      estimatedWaitMinutes: 6,
      estimateLabel: "~6 min",
    });
  });

  it("isolates patient tokens by verified session identity", async () => {
    const { service } = harness();
    const patientB = await service.patientStatus(
      patientProof.create("session-b"),
    );
    expect(patientB.tokenNumber).toBe("A-003");
    expect(patientB.tokenNumber).not.toBe(
      (await service.patientStatus(patientToken)).tokenNumber,
    );
  });

  it("orders priority review before normal arrival without clinical inference", async () => {
    const normal = row({
      id: "normal",
      tokenNumber: "A-001",
      priority: "NORMAL",
      createdAt: new Date("2026-09-14T02:00:00Z"),
    });
    const priority = row({
      id: "priority",
      tokenNumber: "A-002",
      priority: "PRIORITY_REVIEW",
      createdAt: new Date("2026-09-14T03:00:00Z"),
    });
    const { service } = harness({
      queue: vi.fn(async () => [normal, priority]),
    });
    expect(
      (await service.doctorQueue(doctorToken)).entries.map((item) => item.id),
    ).toEqual(["priority", "normal"]);
  });

  it("retries a call-next compare-and-set race and returns one called token", async () => {
    const callNext = vi
      .fn()
      .mockResolvedValueOnce({ kind: "RACE" })
      .mockResolvedValueOnce({
        kind: "CALLED",
        row: row({ status: "CALLED", calledAt: new Date() }),
      });
    const { service } = harness({ callNext });
    expect((await service.callNext(doctorToken)).status).toBe("CALLED");
    expect(callNext).toHaveBeenCalledTimes(2);
  });

  it("blocks patient credentials, unauthorized doctors and invalid completed transitions", async () => {
    const patientCredential = patientProof.create("session-a");
    await expect(
      harness().service.doctorQueue(patientCredential),
    ).rejects.toMatchObject({ code: "DOCTOR_TOKEN_INVALID" });
    await expect(
      harness({ assigned: vi.fn(async () => false) }).service.act(
        "token-a",
        "call",
        doctorToken,
      ),
    ).rejects.toMatchObject({ code: "TOKEN_FORBIDDEN" });
    await expect(
      harness({
        byId: vi.fn(async () => row({ status: "COMPLETED" })),
      }).service.act("token-a", "call", doctorToken),
    ).rejects.toMatchObject({ code: "QUEUE_TRANSITION_INVALID" });
  });

  it("prevents call and recall actions while the queue is paused", async () => {
    const { service, repository } = harness({
      counter: vi.fn(async () => ({ paused: true })),
    });
    await expect(
      service.act("token-a", "call", doctorToken),
    ).rejects.toMatchObject({ code: "QUEUE_PAUSED" });
    await expect(
      service.act("token-a", "recall", doctorToken),
    ).rejects.toMatchObject({ code: "QUEUE_PAUSED" });
    expect(repository.transition).not.toHaveBeenCalled();
    expect(repository.recall).not.toHaveBeenCalled();
  });
});
