'use client';

import { useMemo } from 'react';
import { Loader2, MicOff, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMicPermission } from '@/hooks/useMicPermission';

interface MicPermissionGateProps {
  locale?: 'en' | 'hi';
  children: React.ReactNode;
  onTextMode?: () => void;
}

function getBrowserName(): 'chrome' | 'safari' | 'firefox' | 'other' {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('firefox')) return 'firefox';
  if (ua.includes('safari') && !ua.includes('chrome')) return 'safari';
  if (ua.includes('chrome') || ua.includes('chromium')) return 'chrome';
  return 'other';
}

function getBrowserInstructions(browser: ReturnType<typeof getBrowserName>): string {
  switch (browser) {
    case 'chrome':
      return 'Go to Settings → Privacy and Security → Site Settings → Microphone, and allow this site.';
    case 'safari':
      return 'Go to Safari → Settings → Websites → Microphone, and set this site to "Allow".';
    case 'firefox':
      return 'Click the lock icon in the address bar → Permissions → Microphone → Allow.';
    default:
      return 'Check your browser settings and allow microphone access for this site.';
  }
}

export function MicPermissionGate({ children, onTextMode }: MicPermissionGateProps) {
  const { status, requestPermission, errorDetails } = useMicPermission();

  const browser = useMemo(() => getBrowserName(), []);
  const instructions = useMemo(() => getBrowserInstructions(browser), [browser]);

  // Granted — render children
  if (status === 'granted') {
    return <>{children}</>;
  }

  // Prompt — let children render; the browser will prompt on connect
  if (status === 'prompt') {
    return <>{children}</>;
  }

  // Checking — small loading state
  if (status === 'checking') {
    return (
      <div
        className="flex min-h-svh items-center justify-center bg-[#0a0e1a]"
        aria-label="Checking microphone permission"
      >
        <Loader2 className="h-8 w-8 animate-spin text-[#f5a623]/60" />
      </div>
    );
  }

  // Denied or error — full-screen overlay
  return (
    <div className="vp-gradient-bg fixed inset-0 z-50 flex items-center justify-center px-6">
      <div className="mesh-gradient" />

      <div className="glass-strong relative z-10 flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl px-6 py-8 text-center">
        {/* Red mic-off icon */}
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15 ring-1 ring-red-500/30">
          <MicOff className="h-8 w-8 text-red-400" />
        </div>

        {/* Title */}
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-white/90">Microphone Access Required</h2>
          <p className="text-sm text-white/50">माइक्रोफोन एक्सेस चाहिए</p>
        </div>

        {/* Explanation */}
        <p className="text-sm leading-relaxed text-white/60">
          VoicePay needs your microphone to hear your voice commands. Your audio is processed
          securely and never stored.
        </p>

        {/* Error details */}
        {errorDetails && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300/80">
            {errorDetails}
          </p>
        )}

        {/* Browser-specific instructions */}
        <div className="rounded-lg border border-white/8 bg-white/[0.03] px-4 py-3">
          <p className="text-xs leading-relaxed text-white/50">{instructions}</p>
        </div>

        {/* Actions */}
        <div className="flex w-full flex-col gap-3">
          <Button
            onClick={requestPermission}
            className="btn-gold-gradient w-full rounded-full border-0 px-6 py-2.5 text-sm font-bold"
            aria-label="Try granting microphone permission again"
          >
            Try Again
          </Button>

          {onTextMode && (
            <Button
              variant="ghost"
              onClick={onTextMode}
              className="w-full gap-2 rounded-full border border-white/10 text-sm text-white/60 hover:border-white/20 hover:text-white/80"
              aria-label="Switch to text mode"
            >
              <MessageSquare className="h-4 w-4" />
              Use Text Mode
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
