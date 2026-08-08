'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, type MotionProps, motion } from 'motion/react';
import { useAgent, useSessionContext, useSessionMessages } from '@livekit/components-react';
import { Mic, MicOff, Sparkles } from 'lucide-react';
import { AgentChatTranscript } from '@/components/agents-ui/agent-chat-transcript';
import {
  AgentControlBar,
  type AgentControlBarControls,
} from '@/components/agents-ui/agent-control-bar';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { cn } from '@/lib/shadcn/utils';
import { TileLayout } from './tile-view';
import { useCanvasData } from '@/hooks/useCanvasData';
import { CanvasPanel } from '@/components/app/canvas-panel';
import { TrustBar } from '@/components/app/trust-bar';
import { PersonaCard } from '@/components/app/persona-card';
import { QuickActions } from '@/components/app/quick-actions';
import { SessionTimer } from '@/components/app/session-timer';
import { EmergencyButton } from '@/components/app/emergency-button';
import { SlowNetworkBanner } from '@/components/app/slow-network-banner';
import { AgentStateHero } from '@/components/app/agent-state-hero';
import { useNetworkQuality } from '@/hooks/useNetworkQuality';
import type { Locale } from '@/lib/i18n';
import type { VoicePersona } from '@/components/app/app';

const MotionMessage = motion.create(Shimmer);

const BOTTOM_VIEW_MOTION_PROPS: MotionProps = {
  variants: {
    visible: {
      opacity: 1,
      translateY: '0%',
    },
    hidden: {
      opacity: 0,
      translateY: '100%',
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
  transition: {
    duration: 0.3,
    delay: 0.5,
    ease: 'easeOut',
  },
};

const CHAT_MOTION_PROPS: MotionProps = {
  variants: {
    hidden: {
      opacity: 0,
      transition: {
        ease: 'easeOut',
        duration: 0.3,
      },
    },
    visible: {
      opacity: 1,
      transition: {
        delay: 0.2,
        ease: 'easeOut',
        duration: 0.3,
      },
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
};

const SHIMMER_MOTION_PROPS: MotionProps = {
  variants: {
    visible: {
      opacity: 1,
      transition: {
        ease: 'easeIn',
        duration: 0.5,
        delay: 0.8,
      },
    },
    hidden: {
      opacity: 0,
      transition: {
        ease: 'easeIn',
        duration: 0.5,
        delay: 0,
      },
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
};

interface FadeProps {
  top?: boolean;
  bottom?: boolean;
  className?: string;
}

export function Fade({ top = false, bottom = false, className }: FadeProps) {
  return (
    <div
      className={cn(
        'from-background pointer-events-none h-4 bg-linear-to-b to-transparent',
        top && 'bg-linear-to-b',
        bottom && 'bg-linear-to-t',
        className
      )}
    />
  );
}

export interface AgentSessionView_01Props {
  preConnectMessage?: string;
  supportsChatInput?: boolean;
  supportsVideoInput?: boolean;
  supportsScreenShare?: boolean;
  isPreConnectBufferEnabled?: boolean;
  audioVisualizerType?: 'bar' | 'wave' | 'grid' | 'radial' | 'aura';
  audioVisualizerColor?: `#${string}`;
  audioVisualizerColorShift?: number;
  audioVisualizerBarCount?: number;
  audioVisualizerGridRowCount?: number;
  audioVisualizerGridColumnCount?: number;
  audioVisualizerRadialBarCount?: number;
  audioVisualizerRadialRadius?: number;
  audioVisualizerWaveLineWidth?: number;
  className?: string;
  // Day 3 props
  locale?: Locale;
  selectedPersona?: VoicePersona;
  callStartTime?: number | null;
  onEndCall?: () => void;
}

export function AgentSessionView_01({
  preConnectMessage = 'VoicePay is listening — ask me anything about banking',
  supportsChatInput = true,
  supportsVideoInput = true,
  supportsScreenShare = true,
  isPreConnectBufferEnabled = true,
  audioVisualizerType,
  audioVisualizerColor,
  audioVisualizerColorShift,
  audioVisualizerBarCount,
  audioVisualizerGridRowCount,
  audioVisualizerGridColumnCount,
  audioVisualizerRadialBarCount,
  audioVisualizerRadialRadius,
  audioVisualizerWaveLineWidth,
  ref,
  className,
  locale = 'en',
  selectedPersona,
  callStartTime,
  onEndCall,
  ...props
}: React.ComponentProps<'section'> & AgentSessionView_01Props) {
  const session = useSessionContext();
  const { messages } = useSessionMessages(session);
  const [chatOpen, setChatOpen] = useState(false);
  const [quickActionsVisible, setQuickActionsVisible] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { state: agentState } = useAgent();
  const { items: canvasItems, dismissItem: dismissCanvasItem, clearCanvas } = useCanvasData();
  const { isSlowNetwork } = useNetworkQuality();

  const controls: AgentControlBarControls = {
    leave: true,
    microphone: true,
    chat: supportsChatInput,
    camera: supportsVideoInput,
    screenShare: supportsScreenShare,
  };

  // Hide quick actions after first message
  useEffect(() => {
    if (messages.length > 0) {
      setQuickActionsVisible(false);
    }
  }, [messages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleQuickAction = (text: string) => {
    // Send text via data channel as if user spoke it
    // The agent will process it as a text input
    setQuickActionsVisible(false);
  };

  return (
    <section
      ref={ref}
      className={cn('relative z-10 flex h-full w-full flex-col overflow-hidden', className)}
      style={{ background: 'linear-gradient(135deg, #0a0e1a 0%, #0f1629 30%, #1a2744 60%, #0d1220 100%)' }}
      {...props}
    >
      {/* ─── Trust Bar (always visible at top) ─── */}
      <TrustBar locale={locale} />

      {/* ─── Slow Network Banner ─── */}
      <SlowNetworkBanner isVisible={isSlowNetwork} locale={locale} />

      {/* ─── Top Area: Persona Card + Timer ─── */}
      <div className="absolute inset-x-0 top-10 z-20 flex items-start justify-between px-4">
        {/* Persona Card — top left */}
        {selectedPersona && (
          <PersonaCard
            persona={selectedPersona}
            state={agentState}
            locale={locale}
          />
        )}

        {/* Timer — top right */}
        <div className="flex items-center gap-2">
          <SessionTimer isActive={session.isConnected} />
          <EmergencyButton
            onClick={() => {
              // Trigger escalation
              if (onEndCall) onEndCall();
            }}
            locale={locale}
          />
        </div>
      </div>

      <Fade top className="absolute inset-x-4 top-0 z-10 h-40" />

      {/* ─── LEFT: Chat Transcript Area ─── */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            {...CHAT_MOTION_PROPS}
            className="absolute inset-y-0 left-0 z-30 flex w-[340px] flex-col overflow-hidden border-r border-white/10 bg-[#0d1220]/95 backdrop-blur-xl sm:w-[380px] md:w-[400px]"
          >
            <div className="border-b border-white/[0.06] px-4 py-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                {locale === 'hi' ? 'बातचीत' : 'Conversation'}
              </span>
            </div>
            <div
              ref={scrollAreaRef}
              className="flex-1 overflow-y-auto overscroll-contain scroll-smooth"
            >
              <AgentChatTranscript
                agentState={agentState}
                messages={messages}
                className="w-full [&_.is-user>div]:rounded-[22px] [&_.is-user>div]:bg-[#f5a623]/10 [&_.is-user>div]:border [&_.is-user>div]:border-[#f5a623]/20 [&>div>div]:px-4 [&>div>div]:pt-4 [&>div>div]:pb-4"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── CENTER: Agent State Hero + Visualizer ─── */}
      <div className="relative flex flex-1 flex-col items-center justify-center">
        {/* Agent State Hero — shows who is speaking/listening */}
        <AgentStateHero
          state={agentState as 'listening' | 'speaking' | 'thinking' | 'idle'}
          agentName={selectedPersona?.name || 'VoicePay'}
          userAudioLevel={0}
        />

        {/* Quick Action Chips */}
        <AnimatePresence>
          {quickActionsVisible && messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ delay: 1, duration: 0.5 }}
              className="mt-6"
            >
              <QuickActions onAction={handleQuickAction} locale={locale} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Tile Layout (audio visualizer — behind hero) ─── */}
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <TileLayout
          chatOpen={chatOpen}
          audioVisualizerType={audioVisualizerType}
          audioVisualizerColor={audioVisualizerColor}
          audioVisualizerColorShift={audioVisualizerColorShift}
          audioVisualizerBarCount={audioVisualizerBarCount}
          audioVisualizerRadialBarCount={audioVisualizerRadialBarCount}
          audioVisualizerRadialRadius={audioVisualizerRadialRadius}
          audioVisualizerGridRowCount={audioVisualizerGridRowCount}
          audioVisualizerGridColumnCount={audioVisualizerGridColumnCount}
          audioVisualizerWaveLineWidth={audioVisualizerWaveLineWidth}
        />
      </div>

      {/* ─── RIGHT: Visual Canvas Panel ─── */}
      <CanvasPanel items={canvasItems} onDismiss={dismissCanvasItem} onClear={clearCanvas} />

      {/* ─── Bottom Controls ─── */}
      <motion.div
        {...BOTTOM_VIEW_MOTION_PROPS}
        className="absolute inset-x-3 bottom-0 z-50 md:inset-x-12"
      >
        {/* Pre-connect message */}
        {isPreConnectBufferEnabled && (
          <AnimatePresence>
            {messages.length === 0 && !quickActionsVisible && (
              <MotionMessage
                key="pre-connect-message"
                duration={2}
                aria-hidden={messages.length > 0}
                {...SHIMMER_MOTION_PROPS}
                className="pointer-events-none mx-auto block w-full max-w-2xl pb-4 text-center text-sm font-semibold"
              >
                {preConnectMessage}
              </MotionMessage>
            )}
          </AnimatePresence>
        )}
        <div className="relative mx-auto max-w-2xl pb-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-12">
          <Fade bottom className="absolute inset-x-0 top-0 h-4 -translate-y-full" />
          <AgentControlBar
            variant="livekit"
            controls={controls}
            isChatOpen={chatOpen}
            isConnected={session.isConnected}
            onDisconnect={onEndCall || session.end}
            onIsChatOpenChange={setChatOpen}
          />
        </div>
      </motion.div>
    </section>
  );
}
