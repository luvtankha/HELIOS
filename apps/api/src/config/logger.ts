import pino from "pino";
import { env } from "./env.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "helios-api" },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers.x-session-token",
      "req.headers.x-doctor-token",
      "sessionToken",
      "doctorToken",
      "accessCode",
      "apiKey",
      "*.accessCode",
      "*.sessionToken",
      "*.doctorToken",
      "*.apiKey",
      "password",
      "patient",
      "body",
    ],
    censor: "[REDACTED]",
  },
});
