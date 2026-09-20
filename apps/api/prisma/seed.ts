import { PrismaClient } from "@prisma/client";
import { seedRoutingDataset } from "../src/routing/routing-dataset.js";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertDemoSeedAllowed } from "./demo-guard.js";

assertDemoSeedAllowed(process.env);
const prisma = new PrismaClient();

async function main() {
  await seedRoutingDataset(prisma);
  const foreignPatientCount = await prisma.patientProfile.count({
    where: { patientCode: { not: { startsWith: "DEMO-" } } },
  });
  if (foreignPatientCount)
    throw new Error(
      "Demo seed refuses a database containing non-demo patients",
    );
  const documentFiles = await installDemoDocuments();
  const doctor = await prisma.user.upsert({
    where: { username: "demo.doctor" },
    update: { specializationId: "internal-medicine", acceptingRouting: true },
    create: {
      id: "demo-user-doctor",
      username: "demo.doctor",
      displayName: "Dr. Meera Singh (Synthetic)",
      role: "DOCTOR",
      specializationId: "internal-medicine",
      acceptingRouting: true,
    },
  });
  const secondDoctor = await prisma.user.upsert({
    where: { username: "demo.doctor2" },
    update: { specializationId: "unclassified", acceptingRouting: false },
    create: {
      id: "demo-user-doctor-2",
      username: "demo.doctor2",
      displayName: "Dr. Raj Mehta (Synthetic)",
      role: "DOCTOR",
    },
  });

  const aarav = await upsertPatient(
    "demo-patient-aarav",
    "DEMO-AARAV-024",
    "Aarav Sharma",
    24,
    "MALE",
    "hi",
  );
  const priya = await upsertPatient(
    "demo-patient-priya",
    "DEMO-PRIYA-032",
    "Priya Patel",
    32,
    "FEMALE",
    "en",
  );
  const rohan = await upsertPatient(
    "demo-patient-rohan",
    "DEMO-ROHAN-045",
    "Rohan Verma",
    45,
    "MALE",
    "en",
  );

  const showcasePatients = await Promise.all(
    (
      [
        [
          "fever",
          "DEMO-FEVER-019",
          "Demo Patient Fever 01",
          19,
          "FEMALE",
          "hi",
          "Fever and body ache for three days",
          "Fever",
        ],
        [
          "cough",
          "DEMO-COUGH-061",
          "Demo Patient Cough 02",
          61,
          "MALE",
          "en",
          "Cough for five days",
          "Cough",
        ],
        [
          "chest",
          "DEMO-CHEST-038",
          "Demo Patient Chest 03",
          38,
          "FEMALE",
          "en",
          "Chest discomfort requiring clinical review",
          "Chest discomfort",
        ],
        [
          "diabetes",
          "DEMO-DIAB-052",
          "Demo Patient Diabetes 04",
          52,
          "MALE",
          "hi",
          "Synthetic diabetes follow-up",
          "Increased thirst",
        ],
        [
          "pressure",
          "DEMO-BP-047",
          "Demo Patient Pressure 05",
          47,
          "FEMALE",
          "en",
          "Synthetic blood-pressure follow-up",
          "Headache",
        ],
        [
          "medicine",
          "DEMO-MED-029",
          "Demo Patient Medicine 06",
          29,
          "MALE",
          "en",
          "Question about a current medicine",
          "Nausea",
        ],
        [
          "allergy",
          "DEMO-ALLERGY-035",
          "Demo Patient Allergy 07",
          35,
          "FEMALE",
          "hi",
          "Review of a synthetic allergy history",
          "Rash",
        ],
        [
          "ayush",
          "DEMO-AYUSH-044",
          "Demo Patient AYUSH 08",
          44,
          "MALE",
          "hi",
          "Review of patient-reported AYUSH use",
          "Joint discomfort",
        ],
        [
          "feeling",
          "DEMO-GENERAL-027",
          "Demo Patient General 09",
          27,
          "OTHER",
          "en",
          "General fatigue for clinical review",
          "Fatigue",
        ],
      ] as const
    ).map(
      async ([key, code, name, age, sex, language, complaint, symptom]) => ({
        key,
        complaint,
        symptom,
        patient: await upsertPatient(
          `demo-patient-${key}`,
          code,
          name,
          age,
          sex,
          language,
        ),
      }),
    ),
  );

  for (const patient of [
    aarav,
    priya,
    rohan,
    ...showcasePatients.map((item) => item.patient),
  ]) {
    await prisma.doctorPatientAssignment.upsert({
      where: {
        doctorId_patientId: { doctorId: doctor.id, patientId: patient.id },
      },
      update: { active: true },
      create: { doctorId: doctor.id, patientId: patient.id },
    });
  }
  for (const patient of showcasePatients
    .slice(0, 3)
    .map((item) => item.patient)) {
    await prisma.doctorPatientAssignment.upsert({
      where: {
        doctorId_patientId: {
          doctorId: secondDoctor.id,
          patientId: patient.id,
        },
      },
      update: { active: true },
      create: { doctorId: secondDoctor.id, patientId: patient.id },
    });
  }

  const showcaseVisits = new Map<
    string,
    Awaited<ReturnType<typeof prisma.visit.upsert>>
  >();
  for (const [index, item] of showcasePatients.entries()) {
    const visit = await prisma.visit.upsert({
      where: { id: `demo-visit-${item.key}-current` },
      update: { status: "WAITING" },
      create: {
        id: `demo-visit-${item.key}-current`,
        patientId: item.patient.id,
        status: "WAITING",
        visitType: index % 3 === 0 ? "FOLLOW_UP" : "PRE_CONSULTATION",
        startedAt: new Date(
          `2026-09-13T${String(6 + index).padStart(2, "0")}:00:00.000Z`,
        ),
      },
    });
    showcaseVisits.set(item.key, visit);
    await prisma.clinicalHistory.upsert({
      where: { visitId: visit.id },
      update: { chiefComplaint: `Synthetic demo: ${item.complaint}.` },
      create: {
        visitId: visit.id,
        chiefComplaint: `Synthetic demo: ${item.complaint}.`,
        source: "PATIENT_REPORTED",
      },
    });
    await prisma.symptom.upsert({
      where: { id: `demo-symptom-${item.key}` },
      update: { name: item.symptom, status: "YES" },
      create: {
        id: `demo-symptom-${item.key}`,
        visitId: visit.id,
        name: item.symptom,
        normalizedName: item.symptom.toLowerCase(),
        status: "YES",
        source: "PATIENT_REPORTED",
      },
    });
  }

  const previousVisit = await prisma.visit.upsert({
    where: { id: "demo-visit-aarav-previous" },
    update: {},
    create: {
      id: "demo-visit-aarav-previous",
      patientId: aarav.id,
      tokenNumber: "DEMO-PREV-041",
      status: "COMPLETED",
      visitType: "PRE_CONSULTATION",
      startedAt: new Date("2026-05-10T04:00:00.000Z"),
      completedAt: new Date("2026-05-10T05:00:00.000Z"),
    },
  });

  const currentVisit = await prisma.visit.upsert({
    where: { id: "demo-visit-aarav-current" },
    update: { startedAt: new Date("2026-09-13T04:00:00.000Z") },
    create: {
      id: "demo-visit-aarav-current",
      patientId: aarav.id,
      tokenNumber: "A-127",
      status: "READY_FOR_DOCTOR",
      visitType: "FOLLOW_UP",
      startedAt: new Date("2026-09-13T04:00:00.000Z"),
    },
  });

  const priyaVisit = await prisma.visit.upsert({
    where: { id: "demo-visit-priya-current" },
    update: { status: "WAITING" },
    create: {
      id: "demo-visit-priya-current",
      patientId: priya.id,
      tokenNumber: "B-034",
      status: "WAITING",
      visitType: "PRE_CONSULTATION",
      startedAt: new Date("2026-09-13T04:30:00.000Z"),
    },
  });
  await prisma.clinicalHistory.upsert({
    where: { visitId: priyaVisit.id },
    update: {},
    create: {
      visitId: priyaVisit.id,
      chiefComplaint: "Synthetic demo: recurring headache reported for review.",
      source: "PATIENT_REPORTED",
    },
  });

  const rohanVisit = await prisma.visit.upsert({
    where: { id: "demo-visit-rohan-current" },
    update: { status: "IN_PROGRESS" },
    create: {
      id: "demo-visit-rohan-current",
      patientId: rohan.id,
      tokenNumber: "C-018",
      status: "IN_PROGRESS",
      visitType: "FOLLOW_UP",
      startedAt: new Date("2026-09-13T05:00:00.000Z"),
    },
  });
  await prisma.clinicalHistory.upsert({
    where: { visitId: rohanVisit.id },
    update: {},
    create: {
      visitId: rohanVisit.id,
      chiefComplaint:
        "Synthetic demo: follow-up for persistent knee discomfort.",
      source: "PATIENT_REPORTED",
    },
  });

  await prisma.clinicalHistory.upsert({
    where: { visitId: currentVisit.id },
    update: {},
    create: {
      visitId: currentVisit.id,
      chiefComplaint:
        "Synthetic demo: stomach pain for three days with vomiting.",
      duration: { value: "Three days" },
      location: { value: "Upper abdomen" },
      associatedSymptoms: { vomiting: "Yes" },
      source: "PATIENT_REPORTED",
    },
  });

  await prisma.medication.upsert({
    where: { id: "demo-medication-aarav" },
    update: {
      name: "Metformin",
      normalizedName: "metformin",
      dose: "500 mg",
      frequency: "twice daily",
      source: "DOCTOR_VERIFIED",
      verifiedAt: new Date("2026-05-10T05:00:00.000Z"),
      verificationStatus: "DOCTOR_VERIFIED",
    },
    create: {
      id: "demo-medication-aarav",
      patientId: aarav.id,
      visitId: previousVisit.id,
      name: "Metformin",
      normalizedName: "metformin",
      dose: "500 mg",
      frequency: "twice daily",
      source: "DOCTOR_VERIFIED",
      verifiedAt: new Date("2026-05-10T05:00:00.000Z"),
      verificationStatus: "DOCTOR_VERIFIED",
    },
  });

  await prisma.ayushRecord.upsert({
    where: { id: "demo-ayush-aarav-current" },
    update: {
      system: "AYURVEDA",
      useStatus: "CURRENT",
      verificationStatus: "NEEDS_REVIEW",
    },
    create: {
      id: "demo-ayush-aarav-current",
      patientId: aarav.id,
      visitId: currentVisit.id,
      system: "AYURVEDA",
      useStatus: "CURRENT",
      treatmentName: "Patient-reported Ayurvedic medicine",
      medicineName: "NOT_SPECIFIED",
      originalName: "Ayurvedic medicine",
      normalizedName: "Ayurvedic medicine",
      indicationAsReported: "Joint pain",
      originalStatement:
        "I am also taking an Ayurvedic medicine for joint pain.",
      source: "PATIENT_REPORTED",
      verificationStatus: "NEEDS_REVIEW",
      evidenceReferences: [
        {
          kind: "INTERVIEW",
          sourceId: "demo-ayush-interview-statement",
          label: "Patient interview",
          sourceText: "I am also taking an Ayurvedic medicine for joint pain.",
          language: "en",
          occurredAt: "2026-09-09T04:20:00.000Z",
        },
      ],
    },
  });

  await prisma.medication.upsert({
    where: { id: "demo-medication-aarav-current" },
    update: { dose: "1000 mg", frequency: "twice daily" },
    create: {
      id: "demo-medication-aarav-current",
      patientId: aarav.id,
      visitId: currentVisit.id,
      name: "Metformin",
      normalizedName: "metformin",
      dose: "1000 mg",
      frequency: "twice daily",
      source: "PATIENT_REPORTED",
    },
  });

  await prisma.symptom.upsert({
    where: { id: "demo-symptom-breathing-previous" },
    update: { status: "NOT_ASKED" },
    create: {
      id: "demo-symptom-breathing-previous",
      visitId: previousVisit.id,
      name: "Breathing difficulty",
      normalizedName: "breathing difficulty",
      status: "NOT_ASKED",
      source: "SYSTEM_GENERATED",
    },
  });
  await prisma.symptom.upsert({
    where: { id: "demo-symptom-breathing-current" },
    update: { status: "YES" },
    create: {
      id: "demo-symptom-breathing-current",
      visitId: currentVisit.id,
      name: "Breathing difficulty",
      normalizedName: "breathing difficulty",
      status: "YES",
      source: "PATIENT_REPORTED",
    },
  });

  await prisma.symptom.upsert({
    where: { id: "demo-symptom-abdominal-current" },
    update: {},
    create: {
      id: "demo-symptom-abdominal-current",
      visitId: currentVisit.id,
      name: "Upper abdominal pain",
      normalizedName: "abdominal pain",
      duration: { value: "3 days" },
      location: { value: "Upper abdomen" },
      status: "YES",
      source: "PATIENT_REPORTED",
    },
  });
  await prisma.symptom.upsert({
    where: { id: "demo-symptom-vomiting-current" },
    update: {},
    create: {
      id: "demo-symptom-vomiting-current",
      visitId: currentVisit.id,
      name: "Vomiting",
      normalizedName: "vomiting",
      status: "YES",
      source: "PATIENT_REPORTED",
    },
  });

  await prisma.allergy.upsert({
    where: { id: "demo-allergy-aarav" },
    update: {},
    create: {
      id: "demo-allergy-aarav",
      patientId: aarav.id,
      allergen: "Synthetic demo allergen",
      reaction: "Synthetic mild rash",
      severity: "LOW",
      source: "PATIENT_REPORTED",
    },
  });

  const documentSession = await prisma.patientSession.upsert({
    where: { id: "demo-session-aarav-documents" },
    update: { patientId: aarav.id, visitId: currentVisit.id, language: "hi" },
    create: {
      id: "demo-session-aarav-documents",
      patientId: aarav.id,
      visitId: currentVisit.id,
      language: "hi",
      status: "IN_PROGRESS",
      currentStep: "REVIEW",
    },
  });

  const interview = await prisma.interview.upsert({
    where: { visitId: currentVisit.id },
    update: {
      status: "COMPLETED",
      completeness: 1,
      state: { syntheticDemo: true, unknownFields: ["exact medicine name"] },
    },
    create: {
      id: "demo-interview-aarav-current",
      sessionId: documentSession.id,
      visitId: currentVisit.id,
      pathway: "abdominal-pain",
      state: { syntheticDemo: true, unknownFields: ["exact medicine name"] },
      completeness: 1,
      status: "COMPLETED",
      completedAt: new Date("2026-09-13T04:25:00.000Z"),
    },
  });
  const conversation = [
    [
      "common.chiefComplaint",
      "Mujhe teen din se pet mein dard hai aur vomiting bhi hui.",
      "hi",
      {
        field: "chiefComplaint",
        value: "abdominal pain",
        state: "YES",
        confidence: "HIGH",
      },
    ],
    [
      "abdominal.duration",
      "Teen din se.",
      "hi",
      { field: "duration", value: "3 days", state: "YES", confidence: "HIGH" },
    ],
    [
      "abdominal.location",
      "Upper abdomen mein.",
      "hi",
      {
        field: "location",
        value: "Upper abdomen",
        state: "YES",
        confidence: "HIGH",
      },
    ],
    [
      "abdominal.vomiting",
      "Haan, kal do baar.",
      "hi",
      { field: "vomiting", value: true, state: "YES", confidence: "MEDIUM" },
    ],
    [
      "common.ayush.current",
      "Naam yaad nahi, Ayurvedic medicine leta hoon.",
      "hi",
      {
        field: "ayush",
        value: "unknown medicine",
        state: "UNKNOWN",
        confidence: "LOW",
      },
    ],
  ] as const;
  for (const [
    index,
    [questionId, rawAnswer, language, normalizedAnswer],
  ] of conversation.entries())
    await prisma.interviewResponse.upsert({
      where: { id: `demo-response-aarav-${index + 1}` },
      update: { rawAnswer, normalizedAnswer },
      create: {
        id: `demo-response-aarav-${index + 1}`,
        interviewId: interview.id,
        questionId,
        rawAnswer,
        originalLanguage: language,
        detectedLanguages: ["hi", "en"],
        displayLanguage: "en",
        displayText: rawAnswer,
        normalizedAnswer,
        language,
        source: "PATIENT_REPORTED",
        status: "CONFIRMED",
        verificationStatus: "PATIENT_REPORTED",
        confirmedAt: new Date(
          `2026-09-13T04:${String(10 + index * 2).padStart(2, "0")}:00.000Z`,
        ),
      },
    });
  await prisma.voiceInteraction.upsert({
    where: { id: "demo-voice-aarav-hinglish" },
    update: {},
    create: {
      id: "demo-voice-aarav-hinglish",
      sessionId: documentSession.id,
      visitId: currentVisit.id,
      language: "hi",
      detectedLanguage: "hi",
      detectedLanguages: ["hi", "en"],
      originalTranscript: "Mujhe teen din se pet mein dard hai.",
      normalizedTranscript: "I have had abdominal pain for three days.",
      acceptedTranscript: "Mujhe teen din se pet mein dard hai.",
      confidence: 0.98,
      provider: "synthetic-demo-text-simulation",
      status: "CONFIRMED",
      completedAt: new Date("2026-09-13T04:09:00.000Z"),
    },
  });

  await prisma.medicalDocument.upsert({
    where: { id: "demo-document-aarav" },
    update: {
      documentDate: new Date("2026-05-10T00:00:00.000Z"),
      summary: "Synthetic lab report containing Hemoglobin 10.4 g/dL.",
      processingStatus: "REVIEW_REQUIRED",
      storagePath: "demo-synthetic/aarav/previous-lab.pdf",
      mimeType: "application/pdf",
      ...documentFiles["previous-lab.pdf"],
    },
    create: {
      id: "demo-document-aarav",
      patientId: aarav.id,
      visitId: previousVisit.id,
      sessionId: documentSession.id,
      fileName: "SYNTHETIC-demo-report.pdf",
      mimeType: "application/pdf",
      storagePath: "demo-synthetic/aarav/previous-lab.pdf",
      ...documentFiles["previous-lab.pdf"],
      documentType: "LAB_REPORT",
      documentDate: new Date("2026-05-10T00:00:00.000Z"),
      summary: "Synthetic lab report containing Hemoglobin 10.4 g/dL.",
      uploadedBy: documentSession.id,
      processingStatus: "REVIEW_REQUIRED",
    },
  });

  const previousPage = await prisma.documentPage.upsert({
    where: {
      documentId_pageNumber: {
        documentId: "demo-document-aarav",
        pageNumber: 1,
      },
    },
    update: {},
    create: {
      id: "demo-page-aarav-lab-previous",
      documentId: "demo-document-aarav",
      pageNumber: 1,
      ocrText: "SYNTHETIC: Hemoglobin 10.4 g/dL",
      processingStatus: "REVIEW_REQUIRED",
    },
  });
  await prisma.documentFact.upsert({
    where: { id: "demo-fact-aarav-hb-previous" },
    update: {},
    create: {
      id: "demo-fact-aarav-hb-previous",
      documentId: "demo-document-aarav",
      patientId: aarav.id,
      visitId: previousVisit.id,
      factType: "lab_result",
      originalValue: "Hemoglobin 10.4 g/dL",
      normalizedValue: {
        testName: "Hemoglobin",
        result: 10.4,
        unit: "g/dL",
      },
      confidence: 0.98,
      status: "CONFIRMED",
      evidence: {
        create: {
          pageId: previousPage.id,
          pageNumber: 1,
          sourceText: "Hemoglobin 10.4 g/dL",
          confidence: 0.98,
        },
      },
    },
  });

  const comparisonEvents = [
    {
      id: "demo-compare-hb-previous",
      visitId: previousVisit.id,
      eventType: "LAB_RESULT" as const,
      title: "Hemoglobin",
      sourceType: "DOCUMENT_FACT",
      sourceId: "demo-fact-aarav-hb-previous",
      documentId: "demo-document-aarav",
      documentFactId: "demo-fact-aarav-hb-previous",
      pageNumber: 1,
      sourceText: "Hemoglobin 10.4 g/dL",
      normalizedKey: "hemoglobin",
      normalizedValue: { testName: "Hemoglobin", value: 10.4, unit: "g/dL" },
      source: "DOCUMENT_EXTRACTED" as const,
      verificationStatus: "PATIENT_CONFIRMED" as const,
      eventDate: new Date("2026-05-10T00:00:00.000Z"),
    },
    {
      id: "demo-compare-hb-current",
      visitId: currentVisit.id,
      eventType: "LAB_RESULT" as const,
      title: "Hemoglobin",
      sourceType: "DOCUMENT_FACT",
      sourceId: "demo-fact-aarav-hb-current",
      documentId: "demo-document-aarav-current",
      documentFactId: "demo-fact-aarav-hb-current",
      pageNumber: 1,
      sourceText: "Hemoglobin 8.9 g/dL",
      normalizedKey: "hemoglobin",
      normalizedValue: { testName: "Hemoglobin", value: 8.9, unit: "g/dL" },
      source: "DOCUMENT_EXTRACTED" as const,
      verificationStatus: "PATIENT_CONFIRMED" as const,
      eventDate: new Date("2026-09-01T00:00:00.000Z"),
    },
    {
      id: "demo-compare-medication-previous",
      visitId: previousVisit.id,
      eventType: "MEDICATION_RECORDED" as const,
      title: "Metformin",
      sourceType: "MEDICATION",
      sourceId: "demo-medication-aarav",
      normalizedKey: "metformin",
      normalizedValue: {
        name: "metformin",
        dose: "500 mg",
        frequency: "twice daily",
      },
      source: "DOCTOR_VERIFIED" as const,
      verificationStatus: "DOCTOR_VERIFIED" as const,
      eventDate: previousVisit.startedAt,
    },
    {
      id: "demo-compare-medication-current",
      visitId: currentVisit.id,
      eventType: "MEDICATION_RECORDED" as const,
      title: "Metformin",
      sourceType: "MEDICATION",
      sourceId: "demo-medication-aarav-current",
      normalizedKey: "metformin",
      normalizedValue: {
        name: "metformin",
        dose: "1000 mg",
        frequency: "twice daily",
      },
      source: "PATIENT_REPORTED" as const,
      verificationStatus: "CAPTURED" as const,
      eventDate: currentVisit.startedAt,
    },
    {
      id: "demo-compare-breathing-previous",
      visitId: previousVisit.id,
      eventType: "PATIENT_REPORTED_SYMPTOM" as const,
      title: "Breathing difficulty",
      sourceType: "SYMPTOM",
      sourceId: "demo-symptom-breathing-previous",
      normalizedKey: "breathing difficulty",
      normalizedValue: { name: "breathing difficulty", state: "NOT_ASKED" },
      source: "SYSTEM_GENERATED" as const,
      verificationStatus: "CAPTURED" as const,
      eventDate: previousVisit.startedAt,
    },
    {
      id: "demo-compare-breathing-current",
      visitId: currentVisit.id,
      eventType: "PATIENT_REPORTED_SYMPTOM" as const,
      title: "Breathing difficulty",
      sourceType: "SYMPTOM",
      sourceId: "demo-symptom-breathing-current",
      normalizedKey: "breathing difficulty",
      normalizedValue: { name: "breathing difficulty", state: "YES" },
      source: "PATIENT_REPORTED" as const,
      verificationStatus: "CAPTURED" as const,
      eventDate: currentVisit.startedAt,
    },
  ];
  await prisma.medicalDocument.upsert({
    where: { id: "demo-document-aarav-current" },
    update: {
      storagePath: "demo-synthetic/aarav/current-lab.pdf",
      mimeType: "application/pdf",
      ...documentFiles["current-lab.pdf"],
    },
    create: {
      id: "demo-document-aarav-current",
      patientId: aarav.id,
      visitId: currentVisit.id,
      sessionId: documentSession.id,
      fileName: "SYNTHETIC-current-lab-report.pdf",
      mimeType: "application/pdf",
      storagePath: "demo-synthetic/aarav/current-lab.pdf",
      ...documentFiles["current-lab.pdf"],
      documentType: "LAB_REPORT",
      documentDate: new Date("2026-09-01T00:00:00.000Z"),
      summary: "Synthetic lab report containing Hemoglobin 8.9 g/dL.",
      uploadedBy: documentSession.id,
      processingStatus: "REVIEW_REQUIRED",
    },
  });

  const currentPage = await prisma.documentPage.upsert({
    where: {
      documentId_pageNumber: {
        documentId: "demo-document-aarav-current",
        pageNumber: 1,
      },
    },
    update: {},
    create: {
      id: "demo-page-aarav-lab-current",
      documentId: "demo-document-aarav-current",
      pageNumber: 1,
      ocrText: "SYNTHETIC: Hemoglobin 8.9 g/dL",
      processingStatus: "REVIEW_REQUIRED",
    },
  });
  await prisma.documentFact.upsert({
    where: { id: "demo-fact-aarav-hb-current" },
    update: {},
    create: {
      id: "demo-fact-aarav-hb-current",
      documentId: "demo-document-aarav-current",
      patientId: aarav.id,
      visitId: currentVisit.id,
      factType: "lab_result",
      originalValue: "Hemoglobin 8.9 g/dL",
      normalizedValue: {
        testName: "Hemoglobin",
        result: 8.9,
        unit: "g/dL",
      },
      confidence: 0.97,
      status: "CONFIRMED",
      evidence: {
        create: {
          pageId: currentPage.id,
          pageNumber: 1,
          sourceText: "Hemoglobin 8.9 g/dL",
          confidence: 0.97,
        },
      },
    },
  });

  await prisma.medicalDocument.upsert({
    where: { id: "demo-document-aarav-allergy" },
    update: {
      storagePath: "demo-synthetic/aarav/allergy-note.pdf",
      mimeType: "application/pdf",
      ...documentFiles["allergy-note.pdf"],
    },
    create: {
      id: "demo-document-aarav-allergy",
      patientId: aarav.id,
      visitId: currentVisit.id,
      sessionId: documentSession.id,
      fileName: "SYNTHETIC-old-clinical-note.pdf",
      mimeType: "application/pdf",
      storagePath: "demo-synthetic/aarav/allergy-note.pdf",
      ...documentFiles["allergy-note.pdf"],
      documentType: "CONSULTATION_NOTE",
      documentDate: new Date("2024-02-12T00:00:00.000Z"),
      summary: "Synthetic old note containing an unverified allergy entry.",
      uploadedBy: documentSession.id,
      processingStatus: "REVIEW_REQUIRED",
    },
  });
  const allergyPage = await prisma.documentPage.upsert({
    where: {
      documentId_pageNumber: {
        documentId: "demo-document-aarav-allergy",
        pageNumber: 1,
      },
    },
    update: {},
    create: {
      id: "demo-page-aarav-allergy",
      documentId: "demo-document-aarav-allergy",
      pageNumber: 1,
      ocrText: "SYNTHETIC: Allergy: Penicillin",
      processingStatus: "REVIEW_REQUIRED",
    },
  });
  await prisma.documentFact.upsert({
    where: { id: "demo-fact-aarav-penicillin" },
    update: {},
    create: {
      id: "demo-fact-aarav-penicillin",
      documentId: "demo-document-aarav-allergy",
      patientId: aarav.id,
      visitId: currentVisit.id,
      factType: "allergy",
      originalValue: "Penicillin allergy",
      normalizedValue: { allergen: "Penicillin" },
      confidence: 0.72,
      status: "NEEDS_REVIEW",
      verificationStatus: "NEEDS_REVIEW",
      evidence: {
        create: {
          pageId: allergyPage.id,
          pageNumber: 1,
          sourceText: "Allergy: Penicillin",
          confidence: 0.72,
        },
      },
    },
  });

  await prisma.medication.upsert({
    where: { id: "demo-medication-aarav-unknown" },
    update: {},
    create: {
      id: "demo-medication-aarav-unknown",
      patientId: aarav.id,
      visitId: currentVisit.id,
      name: "Unknown medication",
      normalizedName: "unknown medication",
      source: "AI_STRUCTURED",
      verificationStatus: "AI_STRUCTURED",
    },
  });

  for (const event of comparisonEvents) {
    await prisma.timelineEvent.upsert({
      where: { id: event.id },
      update: {
        normalizedValue: event.normalizedValue,
        eventDate: event.eventDate,
        source: event.source,
        verificationStatus: event.verificationStatus,
        fingerprint: timelineFingerprint(
          aarav.id,
          event.eventType,
          event.source,
          event.sourceId,
          event.normalizedKey,
        ),
      },
      create: {
        ...event,
        patientId: aarav.id,
        fingerprint: timelineFingerprint(
          aarav.id,
          event.eventType,
          event.source,
          event.sourceId,
          event.normalizedKey,
        ),
        datePrecision: "EXACT_DATE",
        temporalState: "CURRENT",
        recordedAt: event.eventDate,
        groupKey: `visit:${event.visitId}`,
      },
    });
  }

  await prisma.timelineEvent.upsert({
    where: { id: "demo-timeline-aarav-lab-previous" },
    update: {},
    create: {
      id: "demo-timeline-aarav-lab-previous",
      patientId: aarav.id,
      visitId: previousVisit.id,
      documentId: "demo-document-aarav",
      eventType: "MEDICAL_DOCUMENT",
      title: "Synthetic lab report",
      description:
        "Hemoglobin 10.4 g/dL (document-extracted; no interpretation).",
      eventDate: new Date("2026-05-10T00:00:00.000Z"),
      source: "DOCUMENT_EXTRACTED",
      sourceType: "MEDICAL_DOCUMENT",
      sourceId: "demo-document-aarav",
      normalizedKey: "document",
      fingerprint: "demo-timeline-fingerprint-aarav-lab-previous",
      datePrecision: "EXACT_DATE",
      temporalState: "HISTORICAL",
      verificationStatus: "DOCUMENT_EXTRACTED",
      recordedAt: new Date("2026-09-09T00:00:00.000Z"),
      groupKey: "document:demo-document-aarav",
    },
  });

  await prisma.timelineEvent.upsert({
    where: { id: "demo-timeline-aarav-lab-current" },
    update: {},
    create: {
      id: "demo-timeline-aarav-lab-current",
      patientId: aarav.id,
      visitId: currentVisit.id,
      documentId: "demo-document-aarav-current",
      eventType: "MEDICAL_DOCUMENT",
      title: "Synthetic lab report",
      description:
        "Hemoglobin 8.9 g/dL (document-extracted; no interpretation).",
      eventDate: new Date("2026-09-01T00:00:00.000Z"),
      source: "DOCUMENT_EXTRACTED",
      sourceType: "MEDICAL_DOCUMENT",
      sourceId: "demo-document-aarav-current",
      normalizedKey: "document",
      fingerprint: "demo-timeline-fingerprint-aarav-lab-current",
      datePrecision: "EXACT_DATE",
      temporalState: "HISTORICAL",
      verificationStatus: "DOCUMENT_EXTRACTED",
      recordedAt: new Date("2026-09-09T00:00:00.000Z"),
      groupKey: "document:demo-document-aarav-current",
    },
  });

  await prisma.timelineEvent.upsert({
    where: { id: "demo-timeline-aarav-previous" },
    update: {},
    create: {
      id: "demo-timeline-aarav-previous",
      patientId: aarav.id,
      visitId: previousVisit.id,
      eventType: "PATIENT_VISIT",
      title: "Synthetic previous consultation",
      description: "Demonstration data only; not a real clinical event.",
      eventDate: previousVisit.startedAt,
      source: "CLINICAL_RECORD",
      sourceType: "VISIT",
      sourceId: previousVisit.id,
      normalizedKey: "visit",
      fingerprint: "demo-timeline-fingerprint-aarav-previous-visit",
      datePrecision: "EXACT_DATE",
      temporalState: "HISTORICAL",
      verificationStatus: "CAPTURED",
      recordedAt: previousVisit.startedAt,
      groupKey: `visit:${previousVisit.id}`,
    },
  });

  // Phase 5 SafetyEngine is absent. Never fabricate a medical safety signal.
  await prisma.riskSignal.deleteMany({
    where: {
      id: { in: ["demo-risk-aarav", "demo-risk-aarav-clinical-review"] },
    },
  });

  // Queue keys follow the current clinic day in India; clinical case contents remain fixed.
  const dayParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const dayValue = (part: string) =>
    dayParts.find((item) => item.type === part)!.value;
  const queueDate = new Date(
    `${dayValue("year")}-${dayValue("month")}-${dayValue("day")}T00:00:00.000Z`,
  );
  const queueCreatedAt = (minutesAgo: number) =>
    new Date(Date.now() - minutesAgo * 60_000);
  await prisma.queueCounter.upsert({
    where: { queueKey_queueDate: { queueKey: "A", queueDate } },
    update: { nextValue: 7, paused: false },
    create: { queueKey: "A", queueDate, nextValue: 7 },
  });
  const demoQueueEntries = [
    {
      id: "demo-queue-aarav",
      sequence: 1,
      tokenNumber: "A-001",
      patientId: aarav.id,
      visitId: currentVisit.id,
      status: "WAITING" as const,
      priority: "PRIORITY_REVIEW" as const,
      createdAt: queueCreatedAt(55),
    },
    {
      id: "demo-queue-priya",
      sequence: 2,
      tokenNumber: "A-002",
      patientId: priya.id,
      visitId: priyaVisit.id,
      status: "WAITING" as const,
      priority: "NORMAL" as const,
      createdAt: queueCreatedAt(40),
    },
    {
      id: "demo-queue-rohan",
      sequence: 3,
      tokenNumber: "A-003",
      patientId: rohan.id,
      visitId: rohanVisit.id,
      doctorId: doctor.id,
      status: "IN_CONSULTATION" as const,
      priority: "NORMAL" as const,
      createdAt: queueCreatedAt(35),
      consultationStartedAt: queueCreatedAt(20),
    },
    ...["fever", "cough", "chest"].map((key, index) => {
      const item = showcasePatients.find((patient) => patient.key === key)!;
      const visit = showcaseVisits.get(key)!;
      return {
        id: `demo-queue-${key}`,
        sequence: index + 4,
        tokenNumber: `A-${String(index + 4).padStart(3, "0")}`,
        patientId: item.patient.id,
        visitId: visit.id,
        status: "WAITING" as const,
        priority:
          key === "chest" ? ("PRIORITY_REVIEW" as const) : ("NORMAL" as const),
        createdAt: queueCreatedAt(30 - index * 5),
      };
    }),
  ];
  for (const entry of demoQueueEntries) {
    await prisma.queueEntry.upsert({
      where: { visitId: entry.visitId },
      update: {
        queueDate,
        createdAt: entry.createdAt,
        status: entry.status,
        priority: entry.priority,
        ...("doctorId" in entry &&
          entry.doctorId && { doctorId: entry.doctorId }),
        ...("consultationStartedAt" in entry &&
          entry.consultationStartedAt && {
            consultationStartedAt: entry.consultationStartedAt,
          }),
      },
      create: { queueKey: "A", queueDate, ...entry },
    });
    await prisma.visit.update({
      where: { id: entry.visitId },
      data: { tokenNumber: entry.tokenNumber },
    });
    await prisma.queueEvent.upsert({
      where: { id: `event-${entry.id}` },
      update: {},
      create: {
        id: `event-${entry.id}`,
        tokenId: entry.id,
        action: "TOKEN_CREATED",
        actorRole: "SYSTEM",
        metadata: { syntheticDemo: true },
      },
    });
  }

  await prisma.doctorNote.upsert({
    where: { id: "demo-doctor-note-aarav" },
    update: {},
    create: {
      id: "demo-doctor-note-aarav",
      patientId: aarav.id,
      visitId: currentVisit.id,
      authorId: doctor.id,
      content:
        "Synthetic demo note: review patient-reported symptoms and source-linked document values during consultation.",
    },
  });

  await prisma.doctorVerification.upsert({
    where: { id: "demo-verification-aarav" },
    update: {},
    create: {
      id: "demo-verification-aarav",
      patientId: aarav.id,
      visitId: previousVisit.id,
      factType: "MEDICATION",
      factId: "demo-medication-aarav",
      action: "VERIFY",
      previousStatus: "PATIENT_REPORTED",
      newStatus: "DOCTOR_VERIFIED",
      originalValue: { label: "SYNTHETIC patient-reported demo" },
      verifiedValue: { label: "SYNTHETIC doctor-verified demo" },
      status: "DOCTOR_VERIFIED",
      sourceType: "PATIENT_REPORTED",
      evidenceReferences: [],
      verifiedBy: doctor.id,
      verifiedAt: new Date("2026-07-02T05:00:00.000Z"),
      comment: "Synthetic seed verification; not clinical information.",
      factVersion: 1,
      idempotencyKey: "00000000-0000-4000-8000-000000000010",
    },
  });

  console.log("Seeded HELIOS synthetic demo records only.");
}

async function upsertPatient(
  id: string,
  patientCode: string,
  fullName: string,
  age: number,
  sex: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY",
  preferredLanguage: string,
) {
  return prisma.patientProfile.upsert({
    where: { patientCode },
    update: { fullName, age, sex, preferredLanguage },
    create: { id, patientCode, fullName, age, sex, preferredLanguage },
  });
}

main()
  .catch((error: unknown) => {
    console.error("Synthetic seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

function timelineFingerprint(
  patientId: string,
  eventType: string,
  source: string,
  sourceId: string,
  normalizedKey: string,
) {
  return createHash("sha256")
    .update(
      [patientId, eventType, source, sourceId, normalizedKey].join("\u001f"),
    )
    .digest("hex");
}

async function installDemoDocuments() {
  const repositoryRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../..",
  );
  const fixtures = resolve(repositoryRoot, "dataset/documents/phase6-fixtures");
  const storage = resolve(
    process.cwd(),
    process.env.STORAGE_PATH ?? "./uploads",
    "demo-synthetic/aarav",
  );
  await mkdir(storage, { recursive: true });
  const files = {
    "previous-lab.pdf": "demo-previous-lab-report.pdf",
    "current-lab.pdf": "demo-current-lab-report.pdf",
    "allergy-note.pdf": "demo-allergy-note.pdf",
  } as const;
  const entries = await Promise.all(
    Object.entries(files).map(async ([target, fixture]) => {
      const sourcePath = resolve(fixtures, fixture);
      const bytes = await readFile(sourcePath);
      await copyFile(sourcePath, resolve(storage, target));
      return [
        target,
        {
          fileSize: bytes.length,
          fileHash: createHash("sha256").update(bytes).digest("hex"),
        },
      ] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<
    keyof typeof files,
    { fileSize: number; fileHash: string }
  >;
}
