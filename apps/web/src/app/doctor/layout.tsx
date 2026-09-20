import { DoctorShell } from "@/components/doctor/doctor-shell";
import { DoctorAuthProvider } from "@/providers/doctor-auth-provider";

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DoctorAuthProvider>
      <DoctorShell>{children}</DoctorShell>
    </DoctorAuthProvider>
  );
}
