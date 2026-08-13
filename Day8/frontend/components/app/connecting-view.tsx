'use client';

import { motion } from 'motion/react';
import { IndianRupee, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ConnectingViewProps {
  agentName?: string;
  locale?: 'en' | 'hi';
  onCancel: () => void;
}

export function ConnectingView({ onCancel, agentName, locale }: ConnectingViewProps) {
  return (
    <div className="vp-gradient-bg fixed inset-0 z-50 flex flex-col items-center justify-center">
      {/* Mesh gradient overlay */}
      <div className="mesh-gradient" />

      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Pulsing logo */}
        <motion.div
          className="relative"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          {/* Outer glow ring */}
          <div className="animate-pulse-ring-outer absolute -inset-4 rounded-full bg-[#f5a623]/15" />
          {/* Inner glow ring */}
          <div className="animate-pulse-ring absolute -inset-2 rounded-full bg-[#f5a623]/25" />
          {/* Logo circle */}
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#f5a623] to-[#e8961f] shadow-lg shadow-[#f5a623]/30">
            <IndianRupee className="h-10 w-10 text-[#0a0e1a]" strokeWidth={2.5} />
          </div>
        </motion.div>

        {/* Animated connecting dots */}
        <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-2 w-2 rounded-full bg-[#f5a623]"
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.2,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>

        {/* Text */}
        <div className="flex flex-col items-center gap-2 text-center">
          <motion.p
            className="text-lg font-semibold text-white/90"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            Connecting to your bank...
          </motion.p>
          <motion.p
            className="text-sm text-white/50"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            Aapke bank se connect ho raha hai
          </motion.p>
        </div>

        {/* Cancel button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.4 }}
        >
          <Button
            variant="ghost"
            onClick={onCancel}
            className="mt-4 gap-2 rounded-full border border-white/10 px-5 py-2 text-sm text-white/60 hover:border-white/20 hover:text-white/80"
            aria-label="Cancel connection"
          >
            <X className="h-4 w-4" />
            Cancel
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
