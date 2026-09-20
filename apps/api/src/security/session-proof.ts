import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";
import { SignedTokenCodec } from "./signed-token.js";

export class SessionProofService {
  private readonly codec: SignedTokenCodec;
  constructor(
    secret = env.SESSION_TOKEN_SECRET,
    ttlSeconds = env.PATIENT_SESSION_TTL_SECONDS,
    now?: () => number,
  ) {
    this.codec = new SignedTokenCodec(
      secret,
      "patient-session",
      ttlSeconds,
      now,
    );
  }

  create(sessionId: string): string {
    return this.codec.create(sessionId);
  }

  verify(token: string | undefined): string {
    if (!token) {
      throw new AppError(
        "This voice session could not be verified",
        401,
        "VOICE_SESSION_TOKEN_REQUIRED",
      );
    }
    const result = this.codec.verify(token);
    if (!result) return this.invalid();
    if (result.expired)
      throw new AppError(
        "This patient session has expired. Please start again.",
        401,
        "SESSION_TOKEN_EXPIRED",
      );
    return result.subject;
  }

  private invalid(): never {
    throw new AppError(
      "This voice session could not be verified",
      403,
      "VOICE_SESSION_TOKEN_INVALID",
    );
  }
}

export const sessionProof = new SessionProofService();
