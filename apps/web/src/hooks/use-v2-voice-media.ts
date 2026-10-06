"use client";

import { useEffect, useState, type RefObject } from "react";
import type { ConsultationEvent } from "@/lib/live-consultation-state";
import {
  patientV2Service,
  PatientV2ApiError,
  type V2VoiceSession,
} from "@/services/patient-v2";
import type { MicrophoneState } from "@/hooks/use-live-microphone";

const TARGET_SAMPLE_RATE = 24_000;
const FRAME_SAMPLES = 1_920;
const SPEECH_RMS_THRESHOLD = 0.025;
const SILENCE_WINDOWS_TO_END = 4;
let primedAudioContext: AudioContext | null = null;

export function primeLiveAudio() {
  try {
    if (!primedAudioContext || primedAudioContext.state === "closed") {
      primedAudioContext = new AudioContext();
    }
    void primedAudioContext.resume().catch(() => undefined);
  } catch {
    // Consent must remain usable when this browser cannot initialize audio.
  }
}

function liveAudioContext() {
  if (!primedAudioContext || primedAudioContext.state === "closed")
    primeLiveAudio();
  if (!primedAudioContext) throw new Error("Audio playback is unavailable");
  return primedAudioContext!;
}

type MediaState =
  | { status: "idle" | "connecting" | "active"; error: null }
  | { status: "error"; error: string };

export function useV2VoiceMedia(
  voiceSession: V2VoiceSession | null,
  sessionToken: string | null,
  microphoneState: MicrophoneState,
  microphoneStreamRef: RefObject<MediaStream | null>,
  dispatch: (event: ConsultationEvent) => void,
): MediaState {
  const [state, setState] = useState<MediaState>({
    status: "idle",
    error: null,
  });

  useEffect(() => {
    if (
      !voiceSession?.media.available ||
      voiceSession.media.transport !== "WEBSOCKET_PCM16" ||
      !voiceSession.media.websocketUrl ||
      !voiceSession.media.credential ||
      microphoneState !== "ready" ||
      !microphoneStreamRef.current
    ) {
      setState({ status: "idle", error: null });
      return;
    }

    const media = voiceSession.media;
    const websocketUrl = media.websocketUrl;
    const credential = media.credential;
    if (!websocketUrl || !credential) {
      setState({
        status: "error",
        error: "बातचीत शुरू नहीं हो सकी। कृपया फिर प्रयास करें।",
      });
      return;
    }
    const stream = microphoneStreamRef.current;
    let disposed = false;
    let terminal = false;
    const reconnectController = new AbortController();
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let handshakeTimer: ReturnType<typeof setTimeout> | undefined;
    let reconnectAttempts = 0;
    let hasConnected = false;
    let captureContext: AudioContext | null = null;
    let playbackContext: AudioContext | null = null;
    let sourceNode: MediaStreamAudioSourceNode | null = null;
    let processorNode: ScriptProcessorNode | null = null;
    let silentGain: GainNode | null = null;
    let websocket: WebSocket | null = null;
    let pendingPcm = new Int16Array(FRAME_SAMPLES);
    let pendingSamples = 0;
    let speaking = false;
    let silentWindows = 0;
    let nextPlaybackTime = 0;
    let completeAfterPlayback = false;
    const playbackSources = new Set<AudioBufferSourceNode>();

    const stopPlayback = () => {
      for (const source of playbackSources) {
        try {
          source.stop();
        } catch {
          // Already stopped.
        }
      }
      playbackSources.clear();
      if (playbackContext) nextPlaybackTime = playbackContext.currentTime;
    };

    const sendControl = (type: string) => {
      if (websocket?.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({ type }));
      }
    };

    const handleSpeechWindow = (samples: Float32Array) => {
      let energy = 0;
      for (const sample of samples) energy += sample * sample;
      const rms = Math.sqrt(energy / Math.max(samples.length, 1));
      if (rms >= SPEECH_RMS_THRESHOLD) {
        silentWindows = 0;
        if (!speaking) {
          speaking = true;
          if (playbackSources.size > 0) {
            stopPlayback();
            sendControl("barge_in");
          }
          dispatch({
            type: "patient.speech.started",
            sequence: 0,
            local: true,
          });
        }
      } else if (speaking) {
        silentWindows += 1;
        if (silentWindows >= SILENCE_WINDOWS_TO_END) {
          speaking = false;
          silentWindows = 0;
          dispatch({ type: "patient.speech.ended", sequence: 0, local: true });
        }
      }
    };

    const sendPcmFrames = (samples: Float32Array, sourceRate: number) => {
      if (websocket?.readyState !== WebSocket.OPEN) return;
      const resampled = resampleMono(samples, sourceRate, TARGET_SAMPLE_RATE);
      for (const sample of resampled) {
        const clamped = Math.max(-1, Math.min(1, sample));
        pendingPcm[pendingSamples++] =
          clamped < 0 ? clamped * 32768 : clamped * 32767;
        if (pendingSamples === FRAME_SAMPLES) {
          websocket.send(pendingPcm.buffer);
          pendingPcm = new Int16Array(FRAME_SAMPLES);
          pendingSamples = 0;
        }
      }
    };

    const playPcmFrame = async (buffer: ArrayBuffer) => {
      if (buffer.byteLength === 0 || buffer.byteLength % 2 !== 0 || disposed || terminal)
        return;
      playbackContext ??= liveAudioContext();
      if (playbackContext.state === "suspended") await playbackContext.resume();
      if (disposed || terminal) return;
      const pcm = new Int16Array(buffer);
      const audio = playbackContext.createBuffer(
        1,
        pcm.length,
        TARGET_SAMPLE_RATE,
      );
      const output = audio.getChannelData(0);
      for (let index = 0; index < pcm.length; index += 1) {
        output[index] = (pcm[index] ?? 0) / 32768;
      }
      const source = playbackContext.createBufferSource();
      source.buffer = audio;
      source.connect(playbackContext.destination);
      const startAt = Math.max(
        playbackContext.currentTime + 0.015,
        nextPlaybackTime,
      );
      nextPlaybackTime = startAt + audio.duration;
      playbackSources.add(source);
      if (playbackSources.size === 1) {
        dispatch({
          type: "doctor.speaking.started",
          sequence: 0,
          local: true,
        });
      }
      source.onended = () => {
        playbackSources.delete(source);
        if (playbackSources.size === 0 && !disposed && !terminal) {
          dispatch({
            type: completeAfterPlayback
              ? "conversation.completed"
              : "doctor.speaking.ended",
            sequence: 0,
            local: true,
          });
        }
      };
      source.start(startAt);
    };

    const startCapture = async () => {
      if (processorNode || disposed || terminal) return;
      captureContext = liveAudioContext();
      if (captureContext.state === "suspended") await captureContext.resume();
      if (disposed || terminal) return;
      sourceNode = captureContext.createMediaStreamSource(stream);
      processorNode = captureContext.createScriptProcessor(4096, 1, 1);
      silentGain = captureContext.createGain();
      silentGain.gain.value = 0;
      processorNode.onaudioprocess = (event) => {
        if (websocket?.readyState !== WebSocket.OPEN || completeAfterPlayback || terminal)
          return;
        const samples = event.inputBuffer.getChannelData(0);
        handleSpeechWindow(samples);
        sendPcmFrames(
          samples,
          captureContext?.sampleRate ?? TARGET_SAMPLE_RATE,
        );
      };
      sourceNode.connect(processorNode);
      processorNode.connect(silentGain);
      silentGain.connect(captureContext.destination);
    };

    const failConnection = () => {
      if (disposed || terminal) return;
      terminal = true;
      const message =
        "बातचीत का संपर्क टूट गया है। आपकी दर्ज जानकारी सुरक्षित है। कृपया क्लिनिक से संपर्क करें।";
      setState({ status: "error", error: message });
      clearTimeout(reconnectTimer);
      clearTimeout(handshakeTimer);
      reconnectController.abort();
      stopPlayback();
      processorNode?.disconnect();
      sourceNode?.disconnect();
      silentGain?.disconnect();
      websocket?.close();
      stream.getTracks().forEach((track) => track.stop());
      dispatch({
        type: "session.ended",
        sequence: 0,
        reason: message,
        local: true,
      });
    };

    const recover = () => {
      if (disposed || terminal || completeAfterPlayback) return;
      if (!sessionToken || reconnectAttempts >= 3) {
        failConnection();
        return;
      }
      reconnectAttempts += 1;
      dispatch({ type: "connection.reconnecting", sequence: 0, local: true });
      setState({ status: "connecting", error: null });
      reconnectTimer = setTimeout(
        () => {
          void patientV2Service
            .resumeVoiceSession(
              voiceSession.voiceSessionId,
              sessionToken,
              voiceSession.lastAcknowledgedSequence,
              reconnectController.signal,
            )
            .then((resumed) => {
              if (disposed || terminal) return;
              if (
                !resumed.media.available ||
                !resumed.media.websocketUrl ||
                !resumed.media.credential
              )
                throw new Error("voice runtime unavailable");
              connect(resumed.media.websocketUrl, resumed.media.credential);
            })
            .catch(async (error: unknown) => {
              if (disposed || terminal) return;
              if (error instanceof PatientV2ApiError && error.status === 409) {
                try {
                  const patient = await patientV2Service.getSession(
                    voiceSession.patientSessionId, sessionToken, reconnectController.signal,
                  );
                  if (disposed || terminal) return;
                  if (["REVIEW", "COMPLETE"].includes(patient.currentStep)) {
                    completeAfterPlayback = true;
                    processorNode?.disconnect();
                    stream.getTracks().forEach((track) => track.stop());
                    setState({ status: "idle", error: null });
                    dispatch({ type: "conversation.completed", sequence: 0, local: true });
                    return;
                  }
                } catch {
                  // The session cannot be verified, so retain the recovery error.
                }
              }
              // A completed/expired session must never start another conversation.
              if (
                error instanceof PatientV2ApiError &&
                [401, 403, 409].includes(error.status ?? 0)
              )
                failConnection();
              else recover();
            });
        },
        750 * 2 ** (reconnectAttempts - 1),
      );
    };

    const connect = (url: string, ticket: string) => {
      if (disposed || terminal) return;
      setState({ status: "connecting", error: null });
      const socket = new WebSocket(url);
      websocket = socket;
      socket.binaryType = "arraybuffer";
      handshakeTimer = setTimeout(() => socket.close(), 10_000);
      socket.onopen = () =>
        socket.send(JSON.stringify({ type: "auth", ticket }));
      socket.onmessage = (event) => {
        if (disposed || terminal || websocket !== socket) return;
        if (event.data instanceof ArrayBuffer) {
          reconnectAttempts = 0;
          void playPcmFrame(event.data).catch(failConnection);
          return;
        }
        if (typeof event.data !== "string") return;
        try {
          const control = JSON.parse(event.data) as {
            type?: string;
            text?: string;
            doctorAvatarId?: string;
          };
          if (control.type === "caption" && typeof control.text === "string") {
            dispatch({
              type: "doctor.speaking.caption",
              sequence: 0,
              text: control.text,
              local: true,
            });
          } else if (control.type === "handoff" && control.doctorAvatarId) {
            dispatch({
              type: "doctor.handoff",
              sequence: 0,
              toAvatarId: control.doctorAvatarId,
              local: true,
            });
          } else if (control.type === "interrupted") {
            stopPlayback();
            dispatch({
              type: "patient.speech.started",
              sequence: 0,
              local: true,
            });
          } else if (control.type === "completed") {
            completeAfterPlayback = true;
            processorNode?.disconnect();
            stream.getTracks().forEach((track) => track.stop());
            if (playbackSources.size === 0)
              dispatch({
                type: "conversation.completed",
                sequence: 0,
                local: true,
              });
          }
          if (control.type === "ready") {
            clearTimeout(handshakeTimer);
            void startCapture()
              .then(() => {
                if (disposed || terminal) return;
                setState({ status: "active", error: null });
                if (hasConnected)
                  dispatch({
                    type: "connection.restored",
                    sequence: 0,
                    local: true,
                  });
                else
                  dispatch({
                    type: "session.ready",
                    sequence: 0,
                    doctorAvatarId: voiceSession.conversation.doctorAvatarId,
                    local: true,
                  });
                hasConnected = true;
              })
              .catch(failConnection);
          }
        } catch {
          // Ignore unknown non-product runtime messages.
        }
      };
      socket.onclose = () => {
        if (!disposed && !terminal && websocket === socket && !completeAfterPlayback) {
          clearTimeout(handshakeTimer);
          stopPlayback();
          pendingSamples = 0;
          speaking = false;
          silentWindows = 0;
          recover();
        }
      };
    };
    try {
      connect(websocketUrl, credential);
    } catch {
      failConnection();
    }

    return () => {
      disposed = true;
      reconnectController.abort();
      clearTimeout(reconnectTimer);
      clearTimeout(handshakeTimer);
      stopPlayback();
      processorNode?.disconnect();
      sourceNode?.disconnect();
      silentGain?.disconnect();
      websocket?.close();
      if (captureContext?.state !== "closed") void captureContext?.close().catch(() => undefined);
      if (playbackContext !== captureContext && playbackContext?.state !== "closed")
        void playbackContext?.close().catch(() => undefined);
      pendingSamples = 0;
    };
  }, [
    dispatch,
    microphoneState,
    microphoneStreamRef,
    sessionToken,
    voiceSession,
  ]);

  return state;
}

export function resampleMono(
  input: Float32Array,
  sourceRate: number,
  targetRate: number,
): Float32Array {
  if (sourceRate <= 0 || targetRate <= 0) {
    throw new Error("audio sample rates must be positive");
  }
  if (sourceRate === targetRate) return input.slice();
  const ratio = sourceRate / targetRate;
  const outputLength = Math.max(1, Math.floor(input.length / ratio));
  const output = new Float32Array(outputLength);
  for (let index = 0; index < outputLength; index += 1) {
    const sourcePosition = index * ratio;
    const left = Math.floor(sourcePosition);
    const right = Math.min(left + 1, input.length - 1);
    const fraction = sourcePosition - left;
    const leftValue = input[left] ?? 0;
    const rightValue = input[right] ?? leftValue;
    output[index] = leftValue + (rightValue - leftValue) * fraction;
  }
  return output;
}
