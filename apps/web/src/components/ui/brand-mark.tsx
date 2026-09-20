export function BrandMark({ inverted = false }: { inverted?: boolean }) {
  return (
    <span
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${inverted ? "bg-teal-300 text-ink" : "bg-ink text-white"}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 40 40" className="h-7 w-7 fill-none" focusable="false">
        <path
          d="M11 10v20M29 10v20M11 20h18"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="30" cy="8" r="2.3" fill="currentColor" />
      </svg>
    </span>
  );
}
