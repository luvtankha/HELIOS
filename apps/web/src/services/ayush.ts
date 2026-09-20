import type { ApiResponse, AyushPatientViewDto } from "@helios/shared";
import { publicConfig } from "@/lib/config";
import { ApiRequestError } from "@/services/patient-flow";

async function request(path: string, token: string) {
  try {
    const response = await fetch(`${publicConfig.apiUrl}/api/v1${path}`, {
      headers: { "x-doctor-token": token },
    });
    const payload = (await response.json()) as ApiResponse<AyushPatientViewDto>;
    if (!response.ok || !payload.success)
      throw new ApiRequestError(
        payload.success
          ? "AYUSH information is unavailable."
          : payload.error.message,
      );
    return payload.data;
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    throw new ApiRequestError(
      "We couldn’t reach the AYUSH information service.",
    );
  }
}

export const ayushApi = {
  doctorView: (patientId: string, token: string) =>
    request(`/doctor/patients/${encodeURIComponent(patientId)}/ayush`, token),
};
