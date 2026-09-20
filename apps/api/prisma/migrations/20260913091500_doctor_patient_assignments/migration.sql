CREATE TABLE "DoctorPatientAssignment" (
  "id" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DoctorPatientAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DoctorPatientAssignment_doctorId_patientId_key" ON "DoctorPatientAssignment"("doctorId", "patientId");
CREATE INDEX "DoctorPatientAssignment_patientId_active_idx" ON "DoctorPatientAssignment"("patientId", "active");
ALTER TABLE "DoctorPatientAssignment" ADD CONSTRAINT "DoctorPatientAssignment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DoctorPatientAssignment" ADD CONSTRAINT "DoctorPatientAssignment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
