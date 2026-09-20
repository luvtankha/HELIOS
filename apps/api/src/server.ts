import { createServer } from "node:http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { database } from "./repositories/database.js";

const server = createServer(createApp());
// Local and hosted transcription have bounded, but intentionally longer,
// processing windows. Keep Node's request timeout above those windows so a
// valid high-accuracy transcription is never cut off by the HTTP server.
server.requestTimeout = Math.max(
  30_000,
  env.SPEECH_LOCAL_TIMEOUT_MS + 5_000,
  env.SPEECH_TIMEOUT_MS + 5_000,
);
server.headersTimeout = 30_000;
server.keepAliveTimeout = 5_000;

server.listen(env.PORT, () =>
  logger.info({ port: env.PORT }, "HELIOS API listening"),
);

function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  server.close(() => {
    database
      .disconnect()
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        logger.error({ err: error }, "Database disconnect failed");
        process.exit(1);
      });
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
