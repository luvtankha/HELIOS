import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "@prisma/client";
import { assertDemoSeedAllowed } from "./demo-guard.js";
import { validateDemoState } from "./validate-demo-state.js";
import { DoctorProofService } from "../security/doctor-proof.js";
import { AppError } from "../utils/app-error.js";

const unavailable = () =>
  new AppError(
    "Demo reset is unavailable outside the SIH demo environment.",
    403,
    "DEMO_RESET_UNAVAILABLE",
  );
const root = fileURLToPath(new URL("../../../../", import.meta.url));

export async function runDemoResetCommand() {
  await new Promise<void>((resolve, reject) => {
    const windows = process.platform === "win32";
    const child = spawn(
      windows ? "cmd.exe" : "pnpm",
      windows
        ? ["/d", "/s", "/c", "pnpm run demo:reset:direct"]
        : ["run", "demo:reset:direct"],
      {
        cwd: root,
        env: process.env,
        windowsHide: true,
        stdio: "ignore",
      },
    );
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Demo reset command exited ${code}`)),
    );
  });
}

export class DemoResetService {
  private busy = false;
  constructor(
    private readonly prisma: PrismaClient,
    private readonly proof = new DoctorProofService(),
    private readonly run = runDemoResetCommand,
    private readonly environment: NodeJS.ProcessEnv = process.env,
  ) {}

  async state() {
    try {
      assertDemoSeedAllowed(this.environment);
    } catch {
      throw unavailable();
    }
    const latest = await this.prisma.auditLog.findFirst({
      where: { action: "DEMO_RESET_SUCCEEDED", entityType: "SIH_DEMO" },
      orderBy: { createdAt: "desc" },
      select: { entityId: true },
    });
    return {
      environment: "sih-demo" as const,
      resetId: latest?.entityId ?? null,
    };
  }

  async reset(
    token: string | undefined,
    confirmation: unknown,
    requestId?: string,
  ) {
    try {
      assertDemoSeedAllowed(this.environment);
    } catch {
      throw unavailable();
    }
    if (confirmation !== "RESET SIH DEMO")
      throw new AppError(
        "Confirm the SIH demo reset before continuing.",
        400,
        "DEMO_RESET_CONFIRMATION_REQUIRED",
      );
    const actorId = this.proof.verify(token);
    const actor = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { id: true, username: true, role: true, status: true },
    });
    if (
      actor?.id !== "demo-user-doctor" ||
      actor.username !== "demo.doctor" ||
      actor.role !== "DOCTOR" ||
      actor.status !== "ACTIVE"
    )
      throw new AppError(
        "Only the SIH demo presenter may reset the demo.",
        403,
        "DEMO_RESET_FORBIDDEN",
      );
    const actual = await this.prisma.$queryRaw<
      Array<{ database: string }>
    >`SELECT current_database() AS database`;
    const configured = new URL(this.environment.DATABASE_URL!).pathname.slice(
      1,
    );
    if (
      actual[0]?.database !== configured ||
      !/^(helios_sih_demo|helios_demo)/i.test(configured)
    )
      throw unavailable();
    if (this.busy)
      throw new AppError(
        "A demo reset is already in progress.",
        409,
        "DEMO_RESET_IN_PROGRESS",
      );
    this.busy = true;
    const resetId = randomUUID();
    const started = Date.now();
    try {
      await this.run();
      const validation = await validateDemoState(this.prisma);
      if (validation.state !== "READY")
        throw new Error("Post-reset validation failed");
      await this.prisma.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "DEMO_RESET_SUCCEEDED",
          entityType: "SIH_DEMO",
          entityId: resetId,
          ...(requestId && { requestId }),
          metadata: {
            environment: "sih-demo",
            actorId: actor.id,
            durationMs: Date.now() - started,
          },
        },
      });
      return {
        environment: "sih-demo" as const,
        scenario: "golden-patient" as const,
        resetId,
        state: "READY" as const,
        durationMs: Date.now() - started,
        validation,
      };
    } catch (error) {
      try {
        await this.prisma.auditLog.create({
          data: {
            action: "DEMO_RESET_FAILED",
            entityType: "SIH_DEMO",
            entityId: resetId,
            ...(requestId && { requestId }),
            metadata: {
              environment: "sih-demo",
              actorId: actor.id,
              reason:
                error instanceof Error
                  ? error.message.slice(0, 100)
                  : "unknown",
            },
          },
        });
      } catch {
        /* Preserve the original failure. */
      }
      throw new AppError(
        "Demo reset failed. Run pnpm demo:reset on the presenter machine and verify the demo before presenting.",
        503,
        "DEMO_RESET_FAILED",
      );
    } finally {
      this.busy = false;
    }
  }
}
