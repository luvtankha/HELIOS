import { useRef } from "react";
import { PrimaryCTA, SecondaryCTA } from "@/components/patient/controls";

export function DocumentUpload({
  busy,
  onFile,
  onSkip,
}: Readonly<{
  busy: boolean;
  onFile(file: File): void;
  onSkip(): void;
}>) {
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  return (
    <div className="mx-auto max-w-xl space-y-3 rounded-3xl border border-ink/10 bg-white p-6 shadow-soft">
      <div
        className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-mist text-3xl"
        aria-hidden="true"
      >
        ▤
      </div>
      <input
        ref={camera}
        className="sr-only"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        capture="environment"
        onChange={(event) =>
          event.target.files?.[0] && onFile(event.target.files[0])
        }
      />
      <input
        ref={gallery}
        className="sr-only"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(event) =>
          event.target.files?.[0] && onFile(event.target.files[0])
        }
      />
      <input
        ref={upload}
        className="sr-only"
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        onChange={(event) =>
          event.target.files?.[0] && onFile(event.target.files[0])
        }
      />
      <PrimaryCTA loading={busy} onClick={() => camera.current?.click()}>
        <span aria-hidden="true">◉</span> Take a photo
      </PrimaryCTA>
      <SecondaryCTA disabled={busy} onClick={() => gallery.current?.click()}>
        Choose a photo
      </SecondaryCTA>
      <SecondaryCTA disabled={busy} onClick={() => upload.current?.click()}>
        Upload a PDF or file
      </SecondaryCTA>
      <button
        type="button"
        disabled={busy}
        onClick={onSkip}
        className="min-h-12 w-full rounded-xl text-sm font-bold text-ink/60 hover:bg-mist"
      >
        Skip for now
      </button>
      <p className="text-center text-xs leading-5 text-ink/45">
        PDF, PNG, JPG, JPEG or WEBP. Your document is stored privately.
      </p>
    </div>
  );
}
