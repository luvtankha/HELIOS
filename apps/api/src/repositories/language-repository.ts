import type { PrismaClient } from "@prisma/client";
import { requireDatabase } from "./database.js";

export class LanguageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async setDoctorLanguage(userId: string, preferredLanguage: string) {
    requireDatabase();
    return this.prisma.user.updateMany({
      where: {
        id: userId,
        role: { in: ["DOCTOR", "ADMIN"] },
        status: "ACTIVE",
      },
      data: { preferredLanguage },
    });
  }
}
