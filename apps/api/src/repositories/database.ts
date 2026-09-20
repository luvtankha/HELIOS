import { PrismaClient } from "@prisma/client";
import type { DatabaseHealth } from "@helios/shared";
import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";

export interface DatabaseService {
  checkConnection(): Promise<DatabaseHealth>;
  disconnect(): Promise<void>;
}

class PrismaDatabaseService implements DatabaseService {
  readonly client = new PrismaClient();

  async checkConnection(): Promise<DatabaseHealth> {
    if (!env.DATABASE_URL) return "not_configured";
    try {
      await this.client.$queryRaw`SELECT 1`;
      return "up";
    } catch {
      return "down";
    }
  }

  async disconnect(): Promise<void> {
    await this.client.$disconnect();
  }
}

export const database = new PrismaDatabaseService();

export function requireDatabase(): void {
  if (!env.DATABASE_URL) {
    throw new AppError(
      "The database is not configured",
      503,
      "DATABASE_NOT_CONFIGURED",
    );
  }
}
