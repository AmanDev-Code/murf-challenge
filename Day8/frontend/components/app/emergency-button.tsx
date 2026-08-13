'use client';

import { AlertTriangle, Phone } from 'lucide-react';

interface EmergencyButtonProps {
  onClick: () => void;
  locale?: 'en' | 'hi';
}

const LABEL = {
  en: 'Talk to Human',
  hi: 'Insaan se baat karo',
} as const;

export function EmergencyButton({ onClick, locale = 'hi' }: EmergencyButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={locale === 'hi' ? 'इंसान से बात करें' : 'Talk to a human agent'}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 hover:shadow-[0_0_12px_rgba(239,68,68,0.15)] transition-all duration-200"
    >
      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{LABEL[locale]}</span>
      <Phone className="h-3 w-3 opacity-60" aria-hidden="true" />
    </button>
  );
}
