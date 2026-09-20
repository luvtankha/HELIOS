import { notFound } from "next/navigation";
import { PresenterPanel } from "./presenter-panel";

export const dynamic = "force-dynamic";

export default function DoctorSihDemoPage() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_DEMO_MODE !== "true"
  )
    notFound();
  return <PresenterPanel />;
}
