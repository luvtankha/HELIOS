"use client";

import { useEffect } from "react";
import {
  consultationEventFromEnvelope,
  type ConsultationEvent,
} from "@/lib/live-consultation-state";
import { patientV2Service, type V2VoiceSession } from "@/services/patient-v2";

export function useV2RealtimeEvents(
  voiceSession: V2VoiceSession | null,
  sessionToken: string | null,
  dispatch: (event: ConsultationEvent) => void,
) {
  useEffect(() => {
    if (!voiceSession?.media.available || !sessionToken) return;
    const controller = new AbortController();
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let sequence = voiceSession.lastAcknowledgedSequence;
    let retries = 0;

    void (async () => {
      while (!controller.signal.aborted && retries < 5) {
        try {
          for await (const envelope of patientV2Service.streamVoiceEvents(
            voiceSession.voiceSessionId,
            sessionToken,
            sequence,
            controller.signal,
          )) {
            sequence = Math.max(sequence, envelope.sequence);
            // Native media owns playback, captions and completion. A control replay
            // must not display unsaid text or interrupt audio that is still playing.
            if (
              voiceSession.media.transport === "WEBSOCKET_PCM16" &&
              ![
                "doctor.handoff",
                "conversation.warning",
                "session.ended",
              ].includes(envelope.type)
            )
              continue;
            const event = consultationEventFromEnvelope(envelope);
            if (event) dispatch(event);
            if (
              envelope.type === "session.ended" ||
              envelope.type === "conversation.completed"
            )
              return;
          }
        } catch {
          // Audio recovery is handled by the media channel; preserve replay offset.
        }
        if (controller.signal.aborted) return;
        retries += 1;
        await new Promise<void>((resolve) => {
          const finish = () => {
            clearTimeout(retryTimer);
            controller.signal.removeEventListener("abort", finish);
            resolve();
          };
          retryTimer = setTimeout(finish, Math.min(750 * 2 ** retries, 10_000));
          controller.signal.addEventListener("abort", finish, { once: true });
        });
      }
    })();

    return () => {
      controller.abort();
      clearTimeout(retryTimer);
    };
  }, [dispatch, sessionToken, voiceSession]);
}
