export function VoiceButton({
  active = false,
  compact = false,
  disabled = false,
  label,
  onClick,
}: Readonly<{
  active?: boolean;
  compact?: boolean;
  disabled?: boolean;
  label?: string;
  onClick(): void;
}>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={
        label ??
        (active ? "Stop microphone recording" : "Start microphone recording")
      }
      className={`voice-button relative grid place-items-center rounded-full text-white shadow-[0_8px_24px_rgba(23,103,139,.14)] transition-colors ${compact ? "h-16 w-16" : "h-32 w-32"} ${active ? "bg-teal" : "bg-ocean"}`}
    >
      {active && (
        <span
          className="absolute inset-[-8px] rounded-full border-2 border-teal/35 motion-safe:animate-pulse"
          aria-hidden="true"
        />
      )}
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={`${compact ? "h-8 w-8" : "h-12 w-12"} fill-none stroke-current stroke-2`}
      >
        <rect x="8" y="3" width="8" height="12" rx="4" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" />
      </svg>
    </button>
  );
}

export function VoiceWaveform({ levels }: Readonly<{ levels?: number[] }>) {
  const bars = levels ?? Array.from({ length: 12 }, () => 0.2);
  return (
    <div
      className="flex h-20 items-center justify-center gap-1.5"
      aria-label="Live microphone level"
    >
      {bars.map((level, index) => (
        <span
          key={index}
          className="w-1.5 rounded-full bg-ocean transition-[height] duration-100 motion-reduce:transition-none"
          style={{ height: `${Math.round(18 + level * 58)}px` }}
        />
      ))}
    </div>
  );
}
