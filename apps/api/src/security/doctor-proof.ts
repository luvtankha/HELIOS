import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";
import { SignedTokenCodec } from "./signed-token.js";

export class DoctorProofService {
  private readonly codec: SignedTokenCodec;
  constructor(
    secret = env.SESSION_TOKEN_SECRET,
    ttlSeconds = env.DOCTOR_SESSION_TTL_SECONDS,
    now?: () => number,
  ) {
    this.codec = new SignedTokenCodec(
      secret,
      "doctor-session",
      ttlSeconds,
      now,
    );
  }
  create(doctorId: string) {
    return this.codec.create(doctorId);
  }
  verify(token: string | undefined) {
    if (!token)
      throw new AppError(
        "Doctor sign-in is required",
        401,
        "DOCTOR_TOKEN_REQUIRED",
      );
    const result = this.codec.verify(token);
    if (!result) return this.invalid();
    if (result.expired)
      throw new AppError(
        "Doctor session has expired. Please sign in again.",
        401,
        "DOCTOR_TOKEN_EXPIRED",
      );
    return result.subject;
  }
  private invalid(): never {
    throw new AppError(
      "Doctor sign-in could not be verified",
      403,
      "DOCTOR_TOKEN_INVALID",
    );
  }
}
