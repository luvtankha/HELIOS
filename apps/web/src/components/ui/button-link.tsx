import type { ReactNode } from "react";

interface ButtonLinkProps {
  children: ReactNode;
  variant?: "primary" | "secondary" | undefined;
  href: string;
  ariaLabel: string;
}

export function ButtonLink({
  children,
  variant = "primary",
  href,
  ariaLabel,
}: ButtonLinkProps) {
  const styles =
    variant === "primary"
      ? "bg-ink text-white hover:bg-ocean"
      : "border border-ink/20 bg-white text-ink hover:border-ocean hover:bg-mist";

  return (
    <a
      href={href}
      aria-label={ariaLabel}
      className={`inline-flex min-h-14 items-center justify-between gap-6 rounded-2xl px-6 py-4 text-left font-bold transition-colors ${styles}`}
    >
      {children}
      <span aria-hidden="true">→</span>
    </a>
  );
}
