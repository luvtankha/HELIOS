import type { HealthData } from "@helios/shared";
import type { DatabaseService } from "../repositories/database.js";

export class HealthService {
  constructor(private readonly database: DatabaseService) {}

  async getHealth(): Promise<HealthData> {
    const database = await this.database.checkConnection();
    return {
      status: database === "down" ? "degraded" : "ok",
      service: "helios-api",
      api: "up",
      database,
      version: "0.1.0",
    };
  }
}
