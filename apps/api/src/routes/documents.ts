import { Router } from "express";
import { DocumentController } from "../controllers/document-controller.js";
import { documentRateLimit } from "../middleware/document-rate-limit.js";
import { receiveDocument } from "../middleware/document-upload.js";
import type { DocumentOperations } from "../services/document-service.js";

export function createDocumentRouter(service: DocumentOperations) {
  const router = Router();
  const controller = new DocumentController(service);
  router.use("/documents", documentRateLimit);
  router.post("/documents", receiveDocument, controller.upload);
  router.get("/patients/:patientId/documents", controller.list);
  router.get("/documents/:id", controller.get);
  router.get("/documents/:id/content", controller.content);
  router.post("/documents/:id/process", controller.process);
  router.get("/documents/:id/status", controller.status);
  router.get("/documents/:id/extraction", controller.extraction);
  router.get("/documents/:id/facts", controller.facts);
  router.post("/documents/:id/facts/:factId/confirm", controller.confirmFact);
  router.post("/documents/:id/facts/:factId/edit", controller.editFact);
  router.post("/documents/:id/facts/:factId/reject", controller.rejectFact);
  router.post("/documents/:id/identity/override", controller.overrideIdentity);
  router.delete("/documents/:id", controller.remove);
  return router;
}
