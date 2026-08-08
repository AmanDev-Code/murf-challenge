'use client';

import { AnimatePresence, motion } from 'motion/react';

interface ConsentModalProps {
  isOpen: boolean;
  onAgree: () => void;
  onTextMode: () => void;
  locale?: 'en' | 'hi';
}

const COPY = {
  en: {
    title: 'Recording Notice',
    message: 'This conversation may be recorded for quality purposes.',
    agree: 'I Agree',
    textMode: 'Text Mode',
  },
  hi: {
    title: 'रिकॉर्डिंग सूचना',
    message: 'यह बातचीत गुणवत्ता के लिए रिकॉर्ड हो सकती है।',
    agree: 'मैं सहमत हूँ',
    textMode: 'टेक्स्ट मोड',
  },
} as const;

export function ConsentModal({ isOpen, onAgree, onTextMode, locale = 'hi' }: ConsentModalProps) {
  const t = COPY[locale];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="consent-title"
          aria-describedby="consent-message"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="w-full max-w-sm rounded-2xl bg-[#0a0e1a]/95 backdrop-blur-xl border border-white/[0.08] p-6 shadow-2xl"
          >
            {/* Title */}
            <h2
              id="consent-title"
              className="text-lg font-semibold text-white/90 text-center mb-2"
            >
              {t.title}
            </h2>

            {/* Message */}
            <p
              id="consent-message"
              className="text-sm text-white/60 text-center mb-6"
            >
              {t.message}
            </p>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={onAgree}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-black bg-gradient-to-r from-[#f5a623] to-[#f7c948] hover:from-[#f7b52e] hover:to-[#f9d35a] transition-all shadow-lg shadow-[#f5a623]/20"
              >
                {t.agree}
              </button>

              <button
                type="button"
                onClick={onTextMode}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-white/70 border border-white/[0.12] hover:bg-white/[0.05] transition-colors"
              >
                {t.textMode}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
