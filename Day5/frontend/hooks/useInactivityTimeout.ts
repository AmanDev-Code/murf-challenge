'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseInactivityTimeoutOptions {
  /** Milliseconds before the soft (warning) timeout fires. */
  softTimeoutMs: number;
  /** Milliseconds before the hard (disconnect) timeout fires. */
  hardTimeoutMs: number;
  /** Called when idle time exceeds softTimeoutMs. */
  onSoftTimeout: () => void;
  /** Called when idle time exceeds hardTimeoutMs. */
  onHardTimeout: () => void;
  /** Whether the session is active. Timers only run when true. */
  isActive: boolean;
}

export interface UseInactivityTimeoutResult {
  /** Seconds elapsed since the last activity signal. */
  secondsIdle: number;
  /** Manually reset the inactivity timers (e.g. on user tap). */
  resetTimer: () => void;
}

/**
 * Tracks user/audio inactivity within a voice call and fires callbacks at
 * configurable soft (warning) and hard (disconnect) thresholds.
 *
 * Timers are paused entirely when `isActive` is false. Call `resetTimer()` or
 * rely on the internal activity watcher (pointer/keyboard/touch/audio events)
 * to push idle time back to 0.
 */
export function useInactivityTimeout({
  softTimeoutMs,
  hardTimeoutMs,
  onSoftTimeout,
  onHardTimeout,
  isActive,
}: UseInactivityTimeoutOptions): UseInactivityTimeoutResult {
  const [secondsIdle, setSecondsIdle] = useState(0);

  const lastActivityRef = useRef<number>(Date.now());
  const softFiredRef = useRef(false);
  const hardFiredRef = useRef(false);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep callback refs stable so the interval closure always uses the latest.
  const onSoftRef = useRef(onSoftTimeout);
  const onHardRef = useRef(onHardTimeout);
  useEffect(() => {
    onSoftRef.current = onSoftTimeout;
  }, [onSoftTimeout]);
  useEffect(() => {
    onHardRef.current = onHardTimeout;
  }, [onHardTimeout]);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    softFiredRef.current = false;
    hardFiredRef.current = false;
    setSecondsIdle(0);
  }, []);

  // Start / stop the tick interval based on isActive.
  useEffect(() => {
    if (!isActive) {
      if (tickIntervalRef.current !== null) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
      setSecondsIdle(0);
      lastActivityRef.current = Date.now();
      softFiredRef.current = false;
      hardFiredRef.current = false;
      return;
    }

    // Reset on activation.
    lastActivityRef.current = Date.now();
    softFiredRef.current = false;
    hardFiredRef.current = false;
    setSecondsIdle(0);

    const tick = () => {
      const elapsed = Date.now() - lastActivityRef.current;
      setSecondsIdle(Math.floor(elapsed / 1000));

      if (!softFiredRef.current && elapsed >= softTimeoutMs) {
        softFiredRef.current = true;
        onSoftRef.current();
      }

      if (!hardFiredRef.current && elapsed >= hardTimeoutMs) {
        hardFiredRef.current = true;
        onHardRef.current();
      }
    };

    tickIntervalRef.current = setInterval(tick, 1000);

    return () => {
      if (tickIntervalRef.current !== null) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    };
  }, [isActive, softTimeoutMs, hardTimeoutMs]);

  // Listen for user interaction events that indicate activity.
  useEffect(() => {
    if (!isActive) return;

    const activityEvents = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'scroll'];

    const handleActivity = () => {
      resetTimer();
    };

    for (const event of activityEvents) {
      window.addEventListener(event, handleActivity, { passive: true });
    }

    return () => {
      for (const event of activityEvents) {
        window.removeEventListener(event, handleActivity);
      }
    };
  }, [isActive, resetTimer]);

  return { secondsIdle, resetTimer };
}
