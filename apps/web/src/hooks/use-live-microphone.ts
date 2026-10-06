"use client";

import { useEffect, useRef, useState } from "react";

export type MicrophoneState = "requesting" | "ready" | "denied" | "unavailable";

export function useLiveMicrophone(enabled = true) {
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<MicrophoneState>("requesting");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    if (!enabled) {
      setState("requesting");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setState("unavailable");
      return;
    }

    setState("requesting");

    void navigator.mediaDevices
      .getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
        video: false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        setState("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const name = error instanceof DOMException ? error.name : "";
        setState(
          name === "NotAllowedError" || name === "SecurityError"
            ? "denied"
            : "unavailable",
        );
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [enabled, attempt]);

  return { state, streamRef, retry: () => setAttempt((value) => value + 1) } as const;
}
