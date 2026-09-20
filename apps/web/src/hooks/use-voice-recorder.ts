"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  initialVoiceState,
  voiceMachineReducer,
  type VoiceMachineEvent,
} from "@/lib/voice-machine";
import { publicConfig } from "@/lib/config";

interface RecordingResult {
  blob: Blob;
  durationSeconds: number;
  signal: AbortSignal;
}

interface VoiceRecorderOptions {
  autoStopOnSilence?: boolean;
  silenceMs?: number;
  speechThreshold?: number;
}

export function useVoiceRecorder(
  onRecording: (
    result: RecordingResult,
    dispatch: React.Dispatch<VoiceMachineEvent>,
  ) => Promise<void>,
  options: VoiceRecorderOptions = {},
) {
  const [state, dispatch] = useReducer(voiceMachineReducer, initialVoiceState);
  const callbackRef = useRef(onRecording);
  callbackRef.current = onRecording;
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const generationRef = useRef(0);
  const activeRef = useRef(false);
  const startedRef = useRef(0);
  const uploadRef = useRef<AbortController | null>(null);
  const speechStartedRef = useRef(false);
  const silenceStartedRef = useRef<number | null>(null);
  const lastLevelUpdateRef = useRef(0);

  const releaseMedia = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== "closed")
      void context.close().catch(() => undefined);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  const dispose = useCallback(() => {
    generationRef.current += 1;
    activeRef.current = false;
    uploadRef.current?.abort();
    uploadRef.current = null;
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
    releaseMedia();
  }, [releaseMedia]);
  useEffect(() => dispose, [dispose]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") {
      dispatch({ type: "STOP" });
      recorder.stop();
    }
  }, []);

  useEffect(() => {
    if (state.status !== "RECORDING") return;
    const timer = window.setInterval(() => {
      dispatch({ type: "TICK" });
      if (
        Date.now() - startedRef.current >=
        publicConfig.voiceMaxDurationSeconds * 1000
      )
        stop();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [state.status, stop]);

  const start = useCallback(async () => {
    if (activeRef.current) return;
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      dispatch({
        type: "FAIL",
        code: "MICROPHONE_UNSUPPORTED",
        message:
          "Microphone recording requires a supported browser on localhost or HTTPS. You can still type your answer.",
      });
      return;
    }
    activeRef.current = true;
    const generation = ++generationRef.current;
    dispatch({ type: "REQUEST_PERMISSION" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      if (generation !== generationRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      speechStartedRef.current = false;
      silenceStartedRef.current = null;
      lastLevelUpdateRef.current = 0;
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, {
        ...(mimeType && { mimeType }),
        audioBitsPerSecond: 64_000,
      });
      recorderRef.current = recorder;
      const chunks: Blob[] = [];
      let bytes = 0;
      let tooLarge = false;
      recorder.addEventListener("dataavailable", (event) => {
        if (generation !== generationRef.current || !event.data.size) return;
        bytes += event.data.size;
        if (bytes > publicConfig.voiceMaxFileBytes) {
          tooLarge = true;
          stop();
        } else chunks.push(event.data);
      });
      recorder.addEventListener("error", () => {
        dispose();
        dispatch({
          type: "FAIL",
          code: "RECORDING_FAILED",
          message:
            "The microphone stopped unexpectedly. Check your device and try again, or type your answer.",
        });
      });
      recorder.addEventListener("stop", () => {
        if (generation !== generationRef.current) return;
        const durationSeconds = Math.max(
          1,
          Math.min(
            publicConfig.voiceMaxDurationSeconds,
            Math.ceil((Date.now() - startedRef.current) / 1000),
          ),
        );
        const blob = new Blob(chunks, {
          type: recorder.mimeType || "audio/webm",
        });
        releaseMedia();
        if (tooLarge || !blob.size) {
          activeRef.current = false;
          dispatch({
            type: "FAIL",
            code: "RECORDING_INVALID",
            message: tooLarge
              ? "The recording is too large. Please try a shorter answer."
              : "The recording was empty. Please check your microphone and try again.",
          });
          return;
        }
        const controller = new AbortController();
        uploadRef.current = controller;
        dispatch({ type: "UPLOAD" });
        const guardedDispatch: React.Dispatch<VoiceMachineEvent> = (event) => {
          if (generation === generationRef.current) dispatch(event);
        };
        void callbackRef
          .current(
            { blob, durationSeconds, signal: controller.signal },
            guardedDispatch,
          )
          .catch(() =>
            guardedDispatch({
              type: "FAIL",
              code: "TRANSCRIPTION_FAILED",
              message:
                "Speech recognition could not finish. Please try again or type your answer.",
            }),
          )
          .finally(() => {
            if (generation === generationRef.current) activeRef.current = false;
          });
      });
      startedRef.current = Date.now();
      recorder.start(500);
      dispatch({ type: "START_RECORDING" });
      // Waveform visualization is optional; capture still works without Web Audio.
      try {
        const context = new AudioContext();
        audioContextRef.current = context;
        const analyser = context.createAnalyser();
        analyser.fftSize = 64;
        context.createMediaStreamSource(stream).connect(analyser);
        const values = new Uint8Array(analyser.frequencyBinCount);
        const visualize = () => {
          if (generation !== generationRef.current) return;
          analyser.getByteFrequencyData(values);
          // VAD still samples every frame, but the decorative waveform only
          // updates about 12 times/second to avoid needless React rendering.
          const now = performance.now();
          if (now - lastLevelUpdateRef.current >= 80) {
            lastLevelUpdateRef.current = now;
            dispatch({
              type: "LEVELS",
              levels: Array.from({ length: 12 }, (_, index) =>
                Math.max(0.12, (values[index * 2] ?? 0) / 255),
              ),
            });
          }
          if (options.autoStopOnSilence && recorder.state === "recording") {
            const average =
              values.reduce((sum, value) => sum + value, 0) / values.length / 255;
            const threshold = options.speechThreshold ?? 0.035;
            if (average >= threshold) {
              speechStartedRef.current = true;
              silenceStartedRef.current = null;
            } else if (speechStartedRef.current) {
              const timestamp = Date.now();
              silenceStartedRef.current ??= timestamp;
              if (timestamp - silenceStartedRef.current >= (options.silenceMs ?? 1300))
                stop();
            }
          }
          if (recorder.state === "recording")
            frameRef.current = requestAnimationFrame(visualize);
        };
        visualize();
      } catch {
        /* Recording does not depend on the waveform. */
      }
    } catch (error) {
      if (generation !== generationRef.current) return;
      dispose();
      const denied =
        error instanceof DOMException &&
        ["NotAllowedError", "SecurityError"].includes(error.name);
      dispatch({
        type: "FAIL",
        code: denied ? "MICROPHONE_DENIED" : "MICROPHONE_UNAVAILABLE",
        message: denied
          ? "Allow microphone access in your browser, then try again. You can also type your answer."
          : "The microphone could not start. Check that a microphone is connected and available.",
      });
    }
  }, [dispose, options.autoStopOnSilence, options.silenceMs, options.speechThreshold, releaseMedia, stop]);

  const cancel = useCallback(() => {
    dispose();
    dispatch({ type: "RESET" });
  }, [dispose]);
  return { state, dispatch, start, stop, cancel };
}
