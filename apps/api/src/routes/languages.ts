import { Router } from "express";
import { LanguageController } from "../controllers/language-controller.js";
import type { LanguageOperations } from "../language/language-service.js";
import { validateBody } from "../validation/middleware.js";
import {
  detectLanguageSchema,
  doctorLanguageSchema,
  normalizeLanguageSchema,
  translateSchema,
} from "../validation/language.js";

export function createLanguageRouter(service: LanguageOperations) {
  const router = Router();
  const controller = new LanguageController(service);
  router.get("/languages", controller.list);
  router.get("/languages/:code", controller.get);
  router.post(
    "/language/detect",
    validateBody(detectLanguageSchema),
    controller.detect,
  );
  router.post(
    "/language/normalize",
    validateBody(normalizeLanguageSchema),
    controller.normalize,
  );
  router.post(
    "/translate",
    validateBody(translateSchema),
    controller.translate,
  );
  router.put(
    "/doctor/language",
    validateBody(doctorLanguageSchema),
    controller.doctorLanguage,
  );
  return router;
}
