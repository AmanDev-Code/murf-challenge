'use client';

import { useEffect, useRef, useState } from 'react';

export interface UseUserAudioLevelResult {
  /** Normalized audio level from 0 (silence) to 1 (loud). */
  level: number;
  /** Whether the mic is producing meaningful audio above the noise floor. */
  isActive: boolean;
}

/** Threshold below which we consider the signal to be silence / noise floor. */
const SILENCE_THRESHOLD = 0.01;

/**
 * Reads real-time audio levels from a MediaStream's first audio track using
 * the Web Audio API. Updates at ~30 fps via requestAnimationFrame.
 *
 * Pass `null` when no stream is available — the hook idles cleanly. All Web
 * Audio resources (AudioContext, AnalyserNode, source node) are torn down on
 * unmount or when the stream changes.
 */
export function useUserAudioLevel(stream: MediaStream | null): UseUserAudioLevelResult {
  const [level, setLevel] = useState(0);
  const [isActive, setIsActive] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Float32Array | null>(null);

  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) {
      setLevel(0);
      setIsActive(false);
      return;
    }

    // Create AudioContext — suspended by default in some browsers; we resume
    // immediately since this is triggered by an explicit user media stream.
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.5;
    analyserRef.current = analyser;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    sourceRef.current = source;

    const bufferLength = analyser.fftSize;
    const dataArray = new Float32Array(bufferLength);
    dataArrayRef.current = dataArray;

    // Ensure the context is running (Chrome autoplay policy).
    if (audioContext.state === 'suspended') {
      void audioContext.resume();
    }

    let lastFrameTime = 0;
    const targetInterval = 1000 / 30; // ~30 fps

    const tick = (timestamp: number) => {
      if (timestamp - lastFrameTime < targetInterval) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      lastFrameTime = timestamp;

      analyser.getFloatTimeDomainData(dataArray);

      // Compute RMS amplitude.
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / bufferLength);

      // Normalize: typical getUserMedia RMS rarely exceeds 0.5, so we scale
      // up to provide a usable 0-1 range. Clamp to 1 just in case.
      const normalized = Math.min(1, rms * 2);

      setLevel(normalized);
      setIsActive(normalized > SILENCE_THRESHOLD);

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      source.disconnect();
      sourceRef.current = null;
      analyserRef.current = null;
      dataArrayRef.current = null;

      void audioContext.close();
      audioContextRef.current = null;

      setLevel(0);
      setIsActive(false);
    };
  }, [stream]);

  return { level, isActive };
}
