'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Wifi, X } from 'lucide-react';

interface SlowNetworkBannerProps {
  isVisible: boolean;
  locale?: 'en' | 'hi';
}

const MESSAGE = {
  en: 'Slow network detected — audio only mode',
  hi: 'धीमा नेटवर्क — केवल ऑडियो',
} as const;

export function SlowNetworkBanner({ isVisible, locale = 'hi' }: SlowNetworkBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  const show = isVisible && !dismissed;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          role="alert"
          aria-live="polite"
          className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20"
        >
          <Wifi className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
          <span className="text-xs text-amber-400">
            {MESSAGE[locale]}
          </span>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label={locale === 'hi' ? 'बंद करें' : 'Dismiss'}
            className="ml-2 p-0.5 rounded hover:bg-amber-500/20 transition-colors"
          >
            <X className="h-3 w-3 text-amber-400/70" aria-hidden="true" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
