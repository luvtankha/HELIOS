import { describe, expect, it, vi } from "vitest";
import { QueueService } from "../../src/queue/queue-service.js";
import type {
  QueueRepository,
  QueueRow,
} from "../../src/queue/queue-repository.js";
import { SessionProofService } from "../../src/security/session-proof.js";
const secret = "phase-fourteen-unit-test-secret-long-enough";
const patientProof = new SessionProofService(secret);
const patientToken = patientProof.create("session-a");
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
    createdAt: new Date(Date.now() - 12 * 60000),
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
        createdAt: new Date(Date.now() - 20 * 60000),
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
});
