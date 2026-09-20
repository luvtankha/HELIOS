import { PatientFlowProvider } from "@/providers/patient-flow-provider";

export default function PatientLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <PatientFlowProvider>{children}</PatientFlowProvider>;
}
