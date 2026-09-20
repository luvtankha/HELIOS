import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { requestContext } from "./middleware/request-context.js";
import { requestLogger } from "./middleware/request-logger.js";
import { database, type DatabaseService } from "./repositories/database.js";
import { createHealthRouter } from "./routes/health.js";
import { createPatientFlowRouter } from "./routes/patient-flow.js";
import { createVoiceRouter } from "./routes/voice.js";
import { createInterviewRouter } from "./routes/interview.js";
import { createDocumentRouter } from "./routes/documents.js";
import { createTimelineRouter } from "./routes/timeline.js";
import { createPatientFlowService } from "./services/domain-services.js";
import { HealthService } from "./services/health-service.js";
import type { PatientFlowOperations } from "./services/patient-flow-service.js";
import { createVoiceService } from "./services/voice-services.js";
import type { VoiceOperations } from "./services/voice-service.js";
import { createInterviewService } from "./services/interview-services.js";
import type { InterviewOperations } from "./services/interview-service.js";
import { createDocumentService } from "./services/document-services.js";
import type { DocumentOperations } from "./services/document-service.js";
import { createTimelineService } from "./services/timeline-services.js";
import type { TimelineOperations } from "./timeline/timeline-service.js";
import { createComparisonRouter } from "./routes/comparisons.js";
import { createComparisonService } from "./services/comparison-services.js";
import type { ComparisonOperations } from "./comparison/comparison-service.js";
import type { ClinicalBriefOperations } from "./clinical-brief/clinical-brief-service.js";
import { createClinicalBriefRouter } from "./routes/clinical-briefs.js";
import { createClinicalBriefService } from "./services/clinical-brief-services.js";
import { createVerificationRouter } from "./routes/verification.js";
import { createVerificationService } from "./services/verification-services.js";
import type { VerificationOperations } from "./verification/verification-service.js";
import { createAyushRouter } from "./routes/ayush.js";
import { createAyushService } from "./services/ayush-services.js";
import type { AyushOperations } from "./ayush/ayush-service.js";
import { createLanguageRouter } from "./routes/languages.js";
import { createLanguageService } from "./services/language-services.js";
import type { LanguageOperations } from "./language/language-service.js";
import { createDoctorDashboardRouter } from "./routes/doctor-dashboard.js";
import { createDoctorDashboardService } from "./services/doctor-dashboard-services.js";
import type { DoctorDashboardOperations } from "./doctor-dashboard/doctor-dashboard-service.js";
import { createQueueRouter } from "./routes/queue.js";
import { QueueService, type QueueOperations } from "./queue/queue-service.js";
import { QueueRepository } from "./queue/queue-repository.js";
import { mutationOriginGuard } from "./middleware/origin-guard.js";
import { DemoResetService } from "./demo/demo-reset-service.js";
import { createDemoResetRouter } from "./routes/demo-reset.js";
import { createSpecializationRoutingRouter } from "./routes/specialization-routing.js";
import { RoutingService } from "./routing/routing-service.js";

export function createApp(
  databaseService: DatabaseService = database,
  patientFlow: PatientFlowOperations = createPatientFlowService(
    database.client,
  ),
  voice: VoiceOperations = createVoiceService(database.client),
  interview: InterviewOperations = createInterviewService(database.client),
  documents: DocumentOperations = createDocumentService(database.client),
  timeline: TimelineOperations = createTimelineService(database.client),
  comparisons: ComparisonOperations = createComparisonService(database.client),
  clinicalBriefs: ClinicalBriefOperations = createClinicalBriefService(
    database.client,
  ),
  verification: VerificationOperations = createVerificationService(
    database.client,
  ),
  ayush: AyushOperations = createAyushService(database.client),
  languages: LanguageOperations = createLanguageService(database.client),
  doctorDashboard: DoctorDashboardOperations = createDoctorDashboardService(
    database.client,
  ),
  queue: QueueOperations = new QueueService(
    new QueueRepository(database.client),
  ),
  demoReset: DemoResetService = new DemoResetService(database.client),
  routing = new RoutingService(database.client),
) {
  const app = express();
  const healthService = new HealthService(databaseService);

  app.disable("x-powered-by");
  app.disable("etag");
  app.set("query parser", "simple");
  app.set("trust proxy", false);
  app.use(requestContext);
  app.use(requestLogger);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: "same-site" },
      referrerPolicy: { policy: "no-referrer" },
      strictTransportSecurity:
        env.NODE_ENV === "production"
          ? { maxAge: 31_536_000, includeSubDomains: true }
          : false,
    }),
  );
  app.use(
    cors({
      origin: env.WEB_ORIGIN,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));
  app.use("/api/v1", (_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use("/api/v1", mutationOriginGuard);

  app.use("/health", createHealthRouter(healthService));
  app.use("/api/v1/health", createHealthRouter(healthService));
  app.use("/api/v1", createPatientFlowRouter(patientFlow));
  app.use("/api/v1/voice", createVoiceRouter(voice));
  app.use("/api/v1/interviews", createInterviewRouter(interview));
  app.use("/api/v1", createDocumentRouter(documents));
  app.use("/api/v1", createTimelineRouter(timeline));
  app.use("/api/v1", createComparisonRouter(comparisons));
  app.use("/api/v1", createClinicalBriefRouter(clinicalBriefs));
  app.use("/api/v1", createVerificationRouter(verification));
  app.use("/api/v1", createAyushRouter(ayush));
  app.use("/api/v1", createLanguageRouter(languages));
  app.use("/api/v1", createDoctorDashboardRouter(doctorDashboard));
  app.use("/api/v1", createQueueRouter(queue));
  app.use("/api/v1", createDemoResetRouter(demoReset));
  app.use("/api/v1", createSpecializationRoutingRouter(routing));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
