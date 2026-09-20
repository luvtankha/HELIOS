import type { ApiResponse, HealthData } from "@helios/shared";
import { publicConfig } from "@/lib/config";

export async function getApiHealth(): Promise<ApiResponse<HealthData>> {
  const response = await fetch(`${publicConfig.apiUrl}/api/v1/health`, {
    cache: "no-store",
  });
  return response.json() as Promise<ApiResponse<HealthData>>;
}
