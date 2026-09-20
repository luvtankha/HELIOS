import { Prisma, type PrismaClient } from "@prisma/client";
import { requireDatabase } from "./database.js";

export class VoiceInteractionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: {
    sessionId: string;
    visitId?: string;
    language: string;
    provider: string;
    model?: string;
    audioMetadata: Prisma.InputJsonValue;
  }) {
    requireDatabase();
    return this.prisma.voiceInteraction.create({
      data: { ...input, status: "PROCESSING" },
    });
  }

  async findById(id: string) {
    requireDatabase();
    return this.prisma.voiceInteraction.findUnique({ where: { id } });
  }

  async markTranscribed(
    id: string,
    input: {
      originalTranscript: string;
      normalizedTranscript?: string;
      detectedLanguage?: string;
      detectedLanguages?: Prisma.InputJsonValue;
      confidence?: number;
    },
  ) {
    requireDatabase();
    return this.prisma.voiceInteraction.update({
      where: { id },
      data: { ...input, status: "TRANSCRIBED", completedAt: new Date() },
    });
  }

  async markFailed(id: string) {
    requireDatabase();
    return this.prisma.voiceInteraction.update({
      where: { id },
      data: { status: "FAILED", completedAt: new Date() },
    });
  }

  async edit(id: string, transcript: string) {
    requireDatabase();
    return this.prisma.voiceInteraction.update({
      where: { id },
      data: { patientEditedTranscript: transcript, status: "EDITED" },
    });
  }

  async confirm(id: string, transcript: string) {
    requireDatabase();
    return this.prisma.voiceInteraction.update({
      where: { id },
      data: {
        acceptedTranscript: transcript,
        status: "CONFIRMED",
        completedAt: new Date(),
      },
    });
  }
}
