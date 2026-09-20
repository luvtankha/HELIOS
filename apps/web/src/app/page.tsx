import { Header } from "@/components/layout/header";
import { FoundationCard } from "@/components/shared/foundation-card";
import { RoleCard } from "@/components/shared/role-card";
import { StatusBadge } from "@/components/ui/status-badge";

const foundations = [
  {
    icon: "◌",
    title: "Accessible by design",
    copy: "Clear language, visible focus states, large touch targets and responsive layouts.",
  },
  {
    icon: "◇",
    title: "Privacy-minded",
    copy: "Server-side validation, structured logs and no sensitive patient data in telemetry.",
  },
  {
    icon: "✓",
    title: "Doctor-reviewable",
    copy: "The architecture reserves verification boundaries for future clinical workflows.",
  },
];

export default function Home() {
  return (
    <main
      id="home"
      className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_78%_22%,#d9f0eb_0,transparent_30%),linear-gradient(135deg,#fffdfa_0%,#f4faf9_55%,#eaf4f7_100%)]"
    >
      <Header />
      <section className="mx-auto grid w-full max-w-7xl items-center gap-12 px-6 pb-16 pt-10 lg:grid-cols-[1.1fr_.9fr] lg:px-10 lg:pb-24 lg:pt-20">
        <div>
          <StatusBadge>People first · Smarter care</StatusBadge>
          <h1 className="mt-6 max-w-3xl font-serif text-5xl leading-[1.02] tracking-tight text-ink sm:text-6xl lg:text-7xl">
            Your health story matters.{" "}
            <span className="text-ocean">Let&apos;s make it heard.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-ink/70">
            Healthcare Enabled Language &amp; Intelligent Observation System
          </p>
          <p className="mt-2 max-w-2xl text-lg leading-8 text-ink/70">
            AI-assisted pre-consultation and clinical case-taking.
          </p>
          <div className="mt-8 grid max-w-2xl gap-4 sm:grid-cols-2">
            <RoleCard
              role="Patient"
              href="/patient"
              icon="♙"
              description="Share your health story"
            />
            <RoleCard
              role="Doctor"
              href="/doctor"
              icon="♧"
              description="Review patient insights"
              variant="secondary"
            />
          </div>
          <p className="mt-4 text-xs text-ink/55">
            The patient journey is available together with a separate doctor
            clinical workspace.
          </p>
        </div>
        <div
          className="relative mx-auto w-full max-w-xl"
          aria-label="HELIOS patient experience overview"
        >
          <div className="absolute -inset-8 rounded-full bg-amber/10 blur-3xl" />
          <div className="relative rounded-[2rem] border border-white bg-white/60 p-4 shadow-soft backdrop-blur-xl sm:p-7">
            <div className="rounded-[1.5rem] bg-ink p-7 text-white">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-[0.25em] text-white/60">
                  System status
                </span>
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
              </div>
              <p className="mt-10 font-serif text-3xl">
                A calm foundation for safer future care journeys.
              </p>
              <div className="mt-8 grid grid-cols-3 gap-3 text-center text-xs">
                {["Web", "API", "Database"].map((item) => (
                  <div
                    key={item}
                    className="rounded-xl border border-white/15 bg-white/5 px-2 py-4"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 rounded-2xl bg-mist p-5 text-sm leading-6 text-ink/70">
              The patient journey now saves consent, details, visit information,
              and a reviewable health story through the HELIOS API.
            </div>
          </div>
        </div>
      </section>
      <section
        className="border-t border-ink/5 bg-white/55"
        aria-labelledby="foundation-title"
      >
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
          <h2 id="foundation-title" className="sr-only">
            Foundation principles
          </h2>
          <div className="grid gap-5 md:grid-cols-3">
            {foundations.map((item) => (
              <FoundationCard key={item.title} {...item} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
