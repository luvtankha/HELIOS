import { describe, expect, it } from "vitest";
import {
  hashDoctorPassword,
  verifyDoctorPassword,
} from "../../src/security/doctor-password.js";
import { ComparisonService } from "../../src/comparison/comparison-service.js";
import type { ComparisonRepository } from "../../src/repositories/comparison-repository.js";
import { env } from "../../src/config/env.js";

describe("configured doctor authentication", () => {
  it("uses salted hashes and rejects incorrect or malformed credentials", async () => {
    const hash = await hashDoctorPassword("synthetic-doctor-password");
    expect(hash).not.toContain("synthetic-doctor-password");
    expect(hash).not.toBe(
      await hashDoctorPassword("synthetic-doctor-password"),
    );
    expect(await verifyDoctorPassword("synthetic-doctor-password", hash)).toBe(
      true,
    );
    expect(await verifyDoctorPassword("incorrect-password", hash)).toBe(false);
    expect(
      await verifyDoctorPassword("synthetic-doctor-password", "corrupt"),
    ).toBe(false);
  });

  it("signs in a configured doctor with demo mode disabled and rejects the demo code", async () => {
    const enabled = env.ENABLE_DEMO_MODE;
    env.ENABLE_DEMO_MODE = false;
    try {
      const passwordHash = await hashDoctorPassword(
        "configured-doctor-password",
      );
      const service = new ComparisonService({
        doctorByUsername: async () => ({
          id: "local-doctor",
          role: "DOCTOR",
          displayName: "Configured Doctor",
          passwordHash,
        }),
      } as unknown as ComparisonRepository);
      expect(
        await service.signIn("doctor", "configured-doctor-password"),
      ).toMatchObject({ doctorId: "local-doctor" });
      await expect(
        service.signIn("doctor", env.DOCTOR_DEMO_ACCESS_CODE),
      ).rejects.toMatchObject({ code: "DOCTOR_SIGN_IN_FAILED" });
    } finally {
      env.ENABLE_DEMO_MODE = enabled;
    }
  });
});
