import type { PatientProfile, PatientSex, PrismaClient } from "@prisma/client";
import { requireDatabase } from "./database.js";

export interface CreatePatientRecord {
  patientCode: string;
  fullName: string;
  age: number;
  sex: PatientSex;
  preferredLanguage: string;
  phone?: string | undefined;
}

export class PatientRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(): Promise<PatientProfile[]> {
    requireDatabase();
    return this.prisma.patientProfile.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async findById(id: string) {
    requireDatabase();
    return this.prisma.patientProfile.findUnique({
      where: { id },
      include: {
        visits: { orderBy: { startedAt: "desc" }, take: 20 },
        medications: { orderBy: { createdAt: "desc" } },
        allergies: { orderBy: { createdAt: "desc" } },
      },
    });
  }

  async create(data: CreatePatientRecord): Promise<PatientProfile> {
    requireDatabase();
    return this.prisma.patientProfile.create({
      data: {
        patientCode: data.patientCode,
        fullName: data.fullName,
        age: data.age,
        sex: data.sex,
        preferredLanguage: data.preferredLanguage,
        ...(data.phone && { phone: data.phone }),
      },
    });
  }
}
