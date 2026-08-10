'use client';

import { Lock } from 'lucide-react';

interface TrustBarProps {
  locale?: 'en' | 'hi';
}

const TEXT = {
  en: 'End-to-end encrypted • RBI-compliant • Your data is safe',
  hi: 'End-to-end encrypted • RBI-compliant • Aapka data safe hai',
} as const;

export function TrustBar({ locale = 'hi' }: TrustBarProps) {
  return (
    <div
      role="banner"
      aria-label={locale === 'hi' ? 'सुरक्षा संकेत' : 'Security signals'}
      className="sticky top-0 z-50 flex items-center justify-center gap-1.5 px-4 py-2 bg-white/[0.03] backdrop-blur-xl border-b border-white/[0.06]"
    >
      <Lock className="h-3 w-3 text-[#f5a623]/80" aria-hidden="true" />
      <span className="text-[11px] text-white/60 tracking-wide">
        {TEXT[locale]}
      </span>
    </div>
  );
}
