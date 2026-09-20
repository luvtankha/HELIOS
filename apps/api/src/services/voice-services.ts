import type { PrismaClient } from "@prisma/client";
import { createSpeechProvider } from "../providers/speech-provider-factory.js";
import { SessionRepository } from "../repositories/session-repository.js";
import { VoiceInteractionRepository } from "../repositories/voice-interaction-repository.js";
import { sessionProof } from "../security/session-proof.js";
import { VoiceService, type VoiceOperations } from "./voice-service.js";

export function createVoiceService(prisma: PrismaClient): VoiceOperations {
  return new VoiceService(
    new VoiceInteractionRepository(prisma),
    new SessionRepository(prisma),
    createSpeechProvider(),
    sessionProof,
  );
}
