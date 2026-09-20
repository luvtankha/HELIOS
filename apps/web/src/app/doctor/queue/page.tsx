import { OperationalQueue } from "@/components/doctor/operational-queue";

export default function DoctorQueuePage() {
  return (
    <main className="p-5 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-bold uppercase tracking-widest text-teal-700">
          Doctor workspace
        </p>
        <h1 className="mt-2 font-serif text-3xl font-bold">
          Waiting and token management
        </h1>
        <OperationalQueue full />
      </div>
    </main>
  );
}
