import { Router } from "express";
import { VoiceController } from "../controllers/voice-controller.js";
import { receiveAudio } from "../middleware/audio-upload.js";
import type { VoiceOperations } from "../services/voice-service.js";
import { validateBody } from "../validation/middleware.js";
import { editTranscriptSchema } from "../validation/voice.js";
import {
  patientWriteRateLimit,
  voiceRateLimit,
} from "../middleware/rate-limit.js";

export function createVoiceRouter(service: VoiceOperations) {
  const router = Router();
  const controller = new VoiceController(service);
  router.post(
    "/transcribe",
    voiceRateLimit,
    receiveAudio,
    controller.transcribe,
  );
  router.get("/:id", controller.get);
  router.post(
    "/:id/edit",
    patientWriteRateLimit,
    validateBody(editTranscriptSchema),
    controller.edit,
  );
  router.post("/:id/confirm", patientWriteRateLimit, controller.confirm);
  return router;
}
