'use client';

import { RefreshCw } from 'lucide-react';

export interface PersonaInfo {
  id: string;
  name: string;
  tagline: string;
  avatar: string;
}

type AgentState = string;

interface PersonaCardProps {
  persona: PersonaInfo;
  state: AgentState;
  locale?: 'en' | 'hi';
  onSwitch?: () => void;
}

const STATE_COLORS: Record<AgentState, string> = {
  speaking: '#f5a623',  // saffron
  listening: '#10b981', // emerald
  thinking: '#3b82f6',  // blue
  idle: '#6b7280',      // gray
};

const STATE_LABELS: Record<AgentState, { en: string; hi: string }> = {
  speaking: { en: 'Speaking', hi: 'बोल रहा है' },
  listening: { en: 'Listening', hi: 'सुन रहा है' },
  thinking: { en: 'Thinking', hi: 'सोच रहा है' },
  idle: { en: 'Idle', hi: 'निष्क्रिय' },
};

export function PersonaCard({ persona, state, locale = 'hi', onSwitch }: PersonaCardProps) {
  const dotColor = STATE_COLORS[state] ?? STATE_COLORS.idle;
  const stateLabel = STATE_LABELS[state]?.[locale] ?? STATE_LABELS.idle[locale];

  return (
    <div
      role="status"
      aria-label={`${persona.name} - ${stateLabel}`}
      className="inline-flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] shadow-lg"
    >
      {/* Avatar */}
      <span className="text-2xl" aria-hidden="true">
        {persona.avatar}
      </span>

      {/* Info */}
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-medium text-white/90 truncate">
          {persona.name}
        </span>
        <span className="text-[11px] text-white/50 truncate">
          {persona.tagline}
        </span>
      </div>

      {/* State indicator */}
      <div className="flex items-center gap-1.5 ml-2">
        <span
          className="h-2 w-2 rounded-full animate-pulse"
          style={{ backgroundColor: dotColor }}
          aria-hidden="true"
        />
        <span className="text-[11px] text-white/50">{stateLabel}</span>
      </div>

      {/* Switch button */}
      {onSwitch && (
        <button
          type="button"
          onClick={onSwitch}
          aria-label={locale === 'hi' ? 'एजेंट बदलें' : 'Switch agent'}
          className="ml-2 p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] transition-colors"
        >
          <RefreshCw className="h-3 w-3 text-white/60" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
