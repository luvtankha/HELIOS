interface FoundationCardProps {
  icon: string;
  title: string;
  copy: string;
}

export function FoundationCard({ icon, title, copy }: FoundationCardProps) {
  return (
    <article className="rounded-card border border-white/80 bg-white/80 p-5 shadow-sm backdrop-blur">
      <span
        className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-mist text-xl"
        aria-hidden="true"
      >
        {icon}
      </span>
      <h2 className="font-bold text-ink">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-ink/65">{copy}</p>
    </article>
  );
}
