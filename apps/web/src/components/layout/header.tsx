export function Header() {
  return (
    <header
      className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 lg:px-10"
      aria-label="Primary navigation"
    >
      <a
        href="#home"
        className="flex items-center gap-3"
        aria-label="HELIOS home"
      >
        <span
          className="grid h-11 w-11 place-items-center rounded-full bg-teal text-xl font-black text-white"
          aria-hidden="true"
        >
          H
        </span>
        <span>
          <strong className="block font-serif text-2xl tracking-wide text-ink">
            HELIOS
          </strong>
          <span className="hidden text-[10px] text-ink/65 sm:block">
            Healthcare Enabled Language &amp; Intelligent Observation System
          </span>
        </span>
      </a>
      <span className="rounded-full border border-ink/10 bg-white px-4 py-2 text-sm text-ink/70">
        Phase 13 · Patient + doctor experiences
      </span>
    </header>
  );
}
