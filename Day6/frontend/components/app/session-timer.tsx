'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';

interface SessionTimerProps {
  isActive: boolean;
  onTimeout?: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function SessionTimer({ isActive, onTimeout }: SessionTimerProps) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive]);

  // Inactivity timeout: trigger after 5 minutes of no interaction
  // (parent controls via isActive toggle; onTimeout is a callback hook)
  useEffect(() => {
    if (onTimeout && elapsed > 0 && elapsed % 300 === 0 && isActive) {
      onTimeout();
    }
  }, [elapsed, isActive, onTimeout]);

  return (
    <div
      role="timer"
      aria-label={`Elapsed time: ${formatTime(elapsed)}`}
      aria-live="off"
      className="inline-flex items-center gap-1 text-[11px] text-white/50 font-mono select-none"
    >
      <Clock className="h-3 w-3" aria-hidden="true" />
      <span>{formatTime(elapsed)}</span>
    </div>
  );
}
