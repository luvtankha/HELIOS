import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";

interface CTAProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  loading?: boolean | undefined;
}

export function PrimaryCTA({
  children,
  loading,
  disabled,
  className = "",
  ...props
}: CTAProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`helios-button-primary inline-flex w-full items-center justify-center gap-3 px-6 py-4 text-base ${className}`}
    >
      {loading && (
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-white/35 border-t-white"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}

export function SecondaryCTA({ children, className = "", ...props }: CTAProps) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border border-ink/15 bg-white px-6 py-4 text-base font-bold text-ink transition hover:border-ocean hover:bg-mist disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

interface LanguageCardProps {
  code: string;
  language: string;
  nativeName: string;
  selected: boolean;
  disabled?: boolean | undefined;
  onSelect(): void;
}

export function LanguageCard({
  code,
  language,
  nativeName,
  selected,
  disabled,
  onSelect,
}: LanguageCardProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onSelect}
      className={`relative min-h-32 rounded-3xl border-2 p-5 text-left transition ${
        selected
          ? "border-ocean bg-white shadow-soft"
          : "border-ink/10 bg-white/60 hover:border-ocean/45"
      } disabled:cursor-not-allowed disabled:opacity-45`}
    >
      <span className="mb-5 grid h-11 w-11 place-items-center rounded-2xl bg-mist text-sm font-black text-ocean">
        {code}
      </span>
      <strong className="block text-lg">{language}</strong>
      <span className="text-sm text-ink/55">{nativeName}</span>
      {selected && (
        <span
          className="absolute right-5 top-5 text-teal"
          aria-label="Selected"
        >
          ✓
        </span>
      )}
    </button>
  );
}

export function ConsentCard({
  icon,
  title,
  children,
}: Readonly<{ icon: string; title: string; children: ReactNode }>) {
  return (
    <li className="flex gap-4 rounded-2xl border border-ink/8 bg-white/70 p-4">
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mist text-teal"
        aria-hidden="true"
      >
        {icon}
      </span>
      <span>
        <strong className="block text-sm">{title}</strong>
        <span className="mt-1 block text-sm leading-6 text-ink/60">
          {children}
        </span>
      </span>
    </li>
  );
}

interface LargeInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
}

export function LargeInput({
  label,
  error,
  hint,
  id,
  ...props
}: LargeInputProps) {
  const inputId = id ?? props.name;
  return (
    <label htmlFor={inputId} className="block">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <input
        {...props}
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={
          error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
        }
        className={`min-h-14 w-full rounded-2xl border bg-white px-4 text-base outline-none transition placeholder:text-ink/30 ${error ? "border-red-500" : "border-ink/15 focus:border-ocean"}`}
      />
      {error && (
        <span
          id={`${inputId}-error`}
          role="alert"
          className="mt-2 block text-sm text-red-700"
        >
          {error}
        </span>
      )}
      {!error && hint && (
        <span id={`${inputId}-hint`} className="mt-2 block text-xs text-ink/50">
          {hint}
        </span>
      )}
    </label>
  );
}

export function AnswerOption({
  selected,
  children,
  onClick,
}: Readonly<{ selected: boolean; children: ReactNode; onClick(): void }>) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 text-left font-semibold transition ${selected ? "border-ocean bg-ocean text-white" : "border-ink/10 bg-white hover:border-ocean/50"}`}
    >
      <span
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${selected ? "border-white bg-white text-ocean" : "border-ink/20"}`}
        aria-hidden="true"
      >
        {selected ? "✓" : ""}
      </span>
      {children}
    </button>
  );
}
