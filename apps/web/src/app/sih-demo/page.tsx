import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoConnectionStatus } from "./status";

export const dynamic = "force-dynamic";

export default function SihDemoPage() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_DEMO_MODE !== "true"
  )
    notFound();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,#d7f0e9,transparent_35%),#f6f8f7] px-5 py-8 text-[#102a43] sm:py-14">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="font-serif text-2xl font-bold">
            HELIOS
          </Link>
          <span className="rounded-full border border-teal-300 bg-teal-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-teal-900">
            SIH demo mode
          </span>
        </header>
        <section className="mt-12 max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-800">
            Smart India Hackathon 2026 · Synthetic demonstration
          </p>
          <h1 className="mt-4 font-serif text-4xl font-bold leading-tight sm:text-6xl">
            Patient waiting time, turned into a clearer clinical story.
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-700">
            HELIOS turns patient waiting time into structured clinical
            intelligence for the doctor. The patient shares their story; the
            doctor reviews evidence and remains the final decision-maker.
          </p>
        </section>
        <DemoConnectionStatus />
        <section
          aria-label="Choose a demonstration"
          className="mt-8 grid gap-4 md:grid-cols-3"
        >
          <DemoCard
            title="Patient experience"
            description="Start the real consent-first Hindi or English intake. Text is available when a microphone is not."
            href="/patient/language"
            action="Start patient intake"
          />
          <DemoCard
            title="Doctor experience"
            description="Sign in to the separate doctor workspace and inspect the live synthetic queue and records."
            href="/doctor/login?returnTo=%2Fdoctor%2Fsih-demo"
            action="Open doctor sign-in"
          />
          <DemoCard
            title="Full end-to-end demo"
            description="Open the protected presenter guide, then move between the real patient and doctor apps."
            href="/doctor/sih-demo"
            action="Open presenter guide"
          />
        </section>
        <p className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          Demonstration data only — all showcase patients and documents are
          synthetic. Clinical safety rules are not available in this build; a
          queue priority label is not a SafetyEngine finding.
        </p>
      </div>
    </main>
  );
}

function DemoCard({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href: string;
  action: string;
}) {
  return (
    <article className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="font-serif text-2xl font-bold">{title}</h2>
      <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">
        {description}
      </p>
      <Link
        href={href}
        className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#0b6f69] px-4 text-center text-sm font-bold text-white hover:bg-[#075c57]"
      >
        {action}
      </Link>
    </article>
  );
}
