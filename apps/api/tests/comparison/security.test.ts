import { DoctorProofService } from "../../src/security/doctor-proof.js";
import { AppError } from "../../src/utils/app-error.js";
import { describe, expect, it } from "vitest";

describe("doctor proof", () => {
  const proof = new DoctorProofService("comparison-test-secret-that-is-long");
  it("round-trips a signed doctor identity", () => {
    expect(proof.verify(proof.create("doctor-1"))).toBe("doctor-1");
  });
  it("rejects missing and tampered credentials", () => {
    expect(() => proof.verify(undefined)).toThrowError(AppError);
    expect(() => proof.verify(`${proof.create("doctor-1")}00`)).toThrowError(
      AppError,
    );
  });
});
