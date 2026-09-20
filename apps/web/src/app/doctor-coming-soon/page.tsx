import Link from "next/link";
import { Header } from "@/components/layout/header";

export default function DoctorComingSoonPage() {
  return (
    <main className="min-h-screen bg-mist">
      <Header />
      <section className="mx-auto max-w-2xl px-6 py-24 text-center">
        <span
          className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white text-2xl text-ocean shadow-soft"
          aria-hidden="true"
        >
          ♧
        </span>
        <h1 className="mt-6 font-serif text-5xl">
          More doctor tools are coming later.
        </h1>
        <p className="mt-5 text-lg leading-8 text-ink/60">
          “What changed?”, Clinical Brief, and the Verification Center are
          available now. Broader clinical tools remain intentionally postponed.
        </p>
        <Link
          href="/doctor/verification"
          className="mt-8 inline-flex min-h-14 items-center rounded-2xl bg-ink px-7 font-bold text-white"
        >
          Open Verification Center
        </Link>
      </section>
    </main>
  );
}
