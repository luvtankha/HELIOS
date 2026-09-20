import type { PatientProfile } from "@prisma/client";
import type { PatientDetailsDto } from "@helios/shared";

export function serializePatient(patient: PatientProfile): PatientDetailsDto {
  return {
    id: patient.id,
    patientCode: patient.patientCode,
    fullName: patient.fullName,
    age: patient.age,
    sex: patient.sex,
    preferredLanguage: patient.preferredLanguage,
    ...(patient.phone && { phone: patient.phone }),
  };
}
