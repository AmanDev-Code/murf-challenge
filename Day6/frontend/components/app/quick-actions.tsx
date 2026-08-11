'use client';

import { AnimatePresence, motion } from 'motion/react';
import { IndianRupee, ArrowUpDown, Calculator, Smartphone } from 'lucide-react';
import type { ElementType } from 'react';

interface QuickActionsProps {
  onAction: (text: string) => void;
  locale?: 'en' | 'hi';
  visible?: boolean;
}

interface Chip {
  hi: string;
  en: string;
  icon: ElementType;
}

const CHIPS: Chip[] = [
  { hi: 'Mera balance batao', en: 'Check my balance', icon: IndianRupee },
  { hi: 'Last transactions', en: 'Recent transactions', icon: ArrowUpDown },
  { hi: 'EMI calculate karo', en: 'Calculate EMI', icon: Calculator },
  { hi: 'UPI kaise bhejte hai', en: 'How to send UPI', icon: Smartphone },
];

export function QuickActions({ onAction, locale = 'hi', visible = true }: QuickActionsProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          role="group"
          aria-label={locale === 'hi' ? 'त्वरित कार्य' : 'Quick actions'}
          className="flex flex-wrap justify-center gap-2 px-4 md:grid md:grid-cols-4 md:gap-3 md:max-w-lg md:mx-auto overflow-x-auto scrollbar-none"
        >
          {CHIPS.map((chip) => {
            const Icon = chip.icon;
            const text = locale === 'hi' ? chip.hi : chip.en;

            return (
              <motion.button
                key={chip.en}
                type="button"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => onAction(text)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/[0.05] backdrop-blur-md border border-white/[0.08] text-xs text-white/70 hover:text-white/90 hover:border-[#f5a623]/30 transition-colors whitespace-nowrap"
              >
                <Icon className="h-3.5 w-3.5 text-[#f5a623]/70" aria-hidden="true" />
                <span>{text}</span>
              </motion.button>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
