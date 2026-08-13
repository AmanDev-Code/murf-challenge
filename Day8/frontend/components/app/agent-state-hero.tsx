'use client';

import { useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Brain, Mic, Sparkles } from 'lucide-react';

type AgentState = string;

interface AgentStateHeroProps {
  state: AgentState;
  agentName: string;
  userAudioLevel: number;
}

interface StateConfig {
  icon: React.ElementType;
  label: string;
  subtitle: string;
  color: string;
  glowColor: string;
  ringColor: string;
}

function getStateConfig(state: AgentState, agentName: string): StateConfig {
  switch (state) {
    case 'listening':
      return {
        icon: Mic,
        label: 'Listening...',
        subtitle: 'bolo aap',
        color: 'from-cyan-400 to-teal-500',
        glowColor: 'rgba(34, 211, 238, 0.3)',
        ringColor: 'rgba(34, 211, 238, 0.25)',
      };
    case 'speaking':
      return {
        icon: Sparkles,
        label: `${agentName} is speaking`,
        subtitle: '',
        color: 'from-[#f5a623] to-[#e8961f]',
        glowColor: 'rgba(245, 166, 35, 0.3)',
        ringColor: 'rgba(245, 166, 35, 0.25)',
      };
    case 'thinking':
      return {
        icon: Brain,
        label: 'Thinking',
        subtitle: '',
        color: 'from-blue-400 to-indigo-500',
        glowColor: 'rgba(96, 165, 250, 0.25)',
        ringColor: 'rgba(96, 165, 250, 0.2)',
      };
    case 'idle':
      return {
        icon: Mic,
        label: 'Ready',
        subtitle: '',
        color: 'from-white/20 to-white/10',
        glowColor: 'rgba(255, 255, 255, 0.1)',
        ringColor: 'rgba(255, 255, 255, 0.08)',
      };
    default:
      return {
        icon: Mic,
        label: 'Ready',
        subtitle: '',
        color: 'from-white/20 to-white/10',
        glowColor: 'rgba(255, 255, 255, 0.1)',
        ringColor: 'rgba(255, 255, 255, 0.08)',
      };
  }
}

function PulsingRings({
  state,
  userAudioLevel,
  ringColor,
}: {
  state: AgentState;
  userAudioLevel: number;
  ringColor: string;
}) {
  // Scale rings based on audio level when listening
  const levelScale = state === 'listening' ? 1 + userAudioLevel * 0.4 : 1;
  const baseDelay = state === 'speaking' ? 0.3 : 0.5;

  return (
    <>
      {/* Ring 1 - innermost */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ border: `2px solid ${ringColor}` }}
        animate={{
          scale: state === 'idle' ? [1.1, 1.15, 1.1] : [1.1, 1.25 * levelScale, 1.1],
          opacity: [0.6, 0.2, 0.6],
        }}
        transition={{
          duration: state === 'thinking' ? 2.5 : 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      {/* Ring 2 - middle */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ border: `1.5px solid ${ringColor}` }}
        animate={{
          scale: state === 'idle' ? [1.2, 1.3, 1.2] : [1.25, 1.5 * levelScale, 1.25],
          opacity: [0.4, 0.1, 0.4],
        }}
        transition={{
          duration: state === 'thinking' ? 3 : 2.4,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: baseDelay,
        }}
      />
      {/* Ring 3 - outermost */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ border: `1px solid ${ringColor}` }}
        animate={{
          scale: state === 'idle' ? [1.35, 1.45, 1.35] : [1.4, 1.75 * levelScale, 1.4],
          opacity: [0.25, 0.05, 0.25],
        }}
        transition={{
          duration: state === 'thinking' ? 3.5 : 2.8,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: baseDelay * 2,
        }}
      />
    </>
  );
}

function ThinkingDots() {
  return (
    <span className="ml-1 inline-flex gap-0.5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block h-1 w-1 rounded-full bg-white/60"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </span>
  );
}

export function AgentStateHero({ state, agentName, userAudioLevel }: AgentStateHeroProps) {
  const config = useMemo(() => getStateConfig(state, agentName), [state, agentName]);
  const Icon = config.icon;

  return (
    <div
      className="flex flex-col items-center gap-6"
      role="status"
      aria-label={`Agent state: ${config.label}`}
    >
      {/* Main circular visualizer */}
      <div className="relative flex h-40 w-40 items-center justify-center">
        {/* Pulsing rings */}
        <PulsingRings
          state={state}
          userAudioLevel={userAudioLevel}
          ringColor={config.ringColor}
        />

        {/* Glow background */}
        <motion.div
          className="absolute inset-2 rounded-full"
          animate={{
            boxShadow: `0 0 40px ${config.glowColor}, 0 0 80px ${config.glowColor}`,
          }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />

        {/* Main circle */}
        <motion.div
          className={`relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br ${config.color} shadow-lg`}
          animate={
            state === 'speaking'
              ? { scale: [1, 1.05, 1] }
              : state === 'thinking'
                ? { scale: [1, 1.02, 1] }
                : { scale: 1 }
          }
          transition={{
            duration: state === 'speaking' ? 1.5 : 2.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          layout
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={state}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              <Icon
                className={`h-10 w-10 ${state === 'idle' ? 'text-white/60' : 'text-white'}`}
                strokeWidth={1.5}
              />
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      {/* State label */}
      <div className="flex flex-col items-center gap-1 text-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={config.label}
            className="text-base font-semibold text-white/90"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            {config.label}
            {state === 'thinking' && <ThinkingDots />}
          </motion.p>
        </AnimatePresence>

        {config.subtitle && (
          <motion.p
            className="text-sm text-white/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            {config.subtitle}
          </motion.p>
        )}
      </div>
    </div>
  );
}
