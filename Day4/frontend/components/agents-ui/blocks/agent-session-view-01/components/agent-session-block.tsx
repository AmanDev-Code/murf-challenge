'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, type MotionProps, motion } from 'motion/react';
import { useAgent, useSessionContext, useSessionMessages } from '@livekit/components-react';
import { Mic, Sparkles, Lock, Clock, Phone, Wifi } from 'lucide-react';
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
import type { VoicePersona } from '@/components/app/app';

const MotionMessage = motion.create(Shimmer);

const BOTTOM_VIEW_MOTION_PROPS: MotionProps = {
  variants: {
    visible: { opacity: 1, translateY: '0%' },
    hidden: { opacity: 0, translateY: '100%' },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
  transition: { duration: 0.3, delay: 0.5, ease: 'easeOut' },
};

const SHIMMER_MOTION_PROPS: MotionProps = {
  variants: {
    visible: { opacity: 1, transition: { ease: 'easeIn', duration: 0.5, delay: 0.8 } },
    hidden: { opacity: 0, transition: { ease: 'easeIn', duration: 0.5, delay: 0 } },
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

// ─────────────────────────────────────────────────────────────────────────
// Agent Status Pill — shows current state clearly
// ─────────────────────────────────────────────────────────────────────────
function AgentStatusPill({ state, agentName }: { state: string; agentName?: string }) {
  const isListening = state === 'listening' || state === 'idle';
  const isSpeaking = state === 'speaking';
  const isThinking = state === 'thinking' || state === 'processing';

  let label = agentName || 'VoicePay';
  let statusColor = 'bg-emerald-400';
  let Icon = Sparkles;

  if (isListening) {
    label = 'Listening... bolo aap';
    statusColor = 'bg-cyan-400';
    Icon = Mic;
  } else if (isSpeaking) {
    label = `${agentName || 'Agent'} is speaking`;
    statusColor = 'bg-[#f5a623]';
    Icon = Sparkles;
  } else if (isThinking) {
    label = 'Thinking...';
    statusColor = 'bg-blue-400';
    Icon = Sparkles;
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 backdrop-blur-xl">
      <span className="relative flex h-2.5 w-2.5">
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${statusColor}`} />
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${statusColor}`} />
      </span>
      <Icon className="h-3.5 w-3.5 text-white/60" />
      <span className="text-xs font-medium text-white/80">{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Trust Bar
// ─────────────────────────────────────────────────────────────────────────
function InlineTrustBar() {
  return (
    <div className="flex items-center justify-center gap-2 border-b border-white/[0.06] bg-white/[0.02] px-4 py-1.5 backdrop-blur-xl">
      <Lock className="h-3 w-3 text-emerald-400" />
      <span className="text-[10px] text-white/50">
        End-to-end encrypted • RBI-compliant • Aapka data safe hai
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Slow Network Banner
// ─────────────────────────────────────────────────────────────────────────
function SlowNetworkBanner({ isVisible }: { isVisible: boolean }) {
  const [dismissed, setDismissed] = useState(false);
  if (!isVisible || dismissed) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex items-center justify-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2"
    >
      <Wifi className="h-3.5 w-3.5 text-amber-400" />
      <span className="text-[11px] font-medium text-amber-300">
        Slow network detected — audio only mode
      </span>
      <button onClick={() => setDismissed(true)} className="ml-2 text-amber-400/60 hover:text-amber-400">✕</button>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Session Timer
// ─────────────────────────────────────────────────────────────────────────
function InlineSessionTimer({ startTime }: { startTime: number | null }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startTime) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);
  const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const secs = (elapsed % 60).toString().padStart(2, '0');
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
      <Clock className="h-3 w-3 text-white/40" />
      <span className="font-mono text-[11px] text-white/50">{mins}:{secs}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Emergency Button
// ─────────────────────────────────────────────────────────────────────────
function InlineEmergencyButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-[11px] text-red-400 transition-colors hover:bg-red-500/20"
      aria-label="Talk to a human agent"
    >
      <Phone className="h-3 w-3" />
      <span className="hidden sm:inline">Human</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Quick Action Chips
// ─────────────────────────────────────────────────────────────────────────
function InlineQuickActions() {
  const actions = [
    'Mera balance batao',
    'Last transactions',
    'EMI calculate karo',
    'UPI kaise bhejte hai',
  ];
  return (
    <div className="flex flex-wrap justify-center gap-2 px-4">
      {actions.map((text) => (
        <span
          key={text}
          className="cursor-pointer rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/60 transition-colors hover:border-[#f5a623]/30 hover:text-white/80"
        >
          {text}
        </span>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Live Transcript — always visible at bottom, auto-scrolls
// ─────────────────────────────────────────────────────────────────────────
function LiveTranscript({ messages, agentState }: { messages: any[]; agentState: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute inset-x-0 bottom-24 z-40 mx-auto max-w-xl px-4 md:bottom-28"
    >
      <div className="rounded-2xl border border-white/[0.08] bg-[#0d1220]/90 backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
            Live Transcript
          </span>
        </div>
        {/* Messages */}
        <div
          ref={scrollRef}
          className="max-h-32 overflow-y-auto overscroll-contain scroll-smooth px-4 py-3"
        >
          {messages.slice(-6).map((msg, i) => {
            const isUser = msg.from?.isLocal === true;
            const text = msg.message || msg.content || msg.text || '';
            if (!text) return null;
            return (
              <div key={msg.id || i} className={`mb-2 last:mb-0 ${isUser ? 'text-right' : 'text-left'}`}>
                <span
                  className={`inline-block max-w-[85%] rounded-2xl px-3 py-1.5 text-xs leading-relaxed ${
                    isUser
                      ? 'rounded-br-md bg-cyan-500/15 text-cyan-200/90 border border-cyan-500/20'
                      : 'rounded-bl-md bg-[#f5a623]/10 text-white/80 border border-[#f5a623]/15'
                  }`}
                >
                  {text}
                </span>
              </div>
            );
          })}
          {/* Typing indicator when agent is thinking */}
          {agentState === 'thinking' && (
            <div className="text-left">
              <span className="inline-block rounded-2xl rounded-bl-md bg-[#f5a623]/10 border border-[#f5a623]/15 px-3 py-1.5 text-xs text-white/50">
                <span className="animate-pulse">●●●</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Detect slow network
// ─────────────────────────────────────────────────────────────────────────
function useSlowNetwork(): boolean {
  const [isSlow, setIsSlow] = useState(false);
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const nav = navigator as any;
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    if (!conn) return;
    const check = () => {
      const type = conn.effectiveType;
      setIsSlow(type === '2g' || type === 'slow-2g');
    };
    check();
    conn.addEventListener?.('change', check);
    return () => conn.removeEventListener?.('change', check);
  }, []);
  return isSlow;
}

// ─────────────────────────────────────────────────────────────────────────
// MAIN SESSION VIEW
// ─────────────────────────────────────────────────────────────────────────
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
  locale?: string;
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
  locale,
  selectedPersona,
  callStartTime,
  onEndCall,
  ...props
}: React.ComponentProps<'section'> & AgentSessionView_01Props) {
  const session = useSessionContext();
  const { messages } = useSessionMessages(session);
  const [chatOpen, setChatOpen] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { state: agentState } = useAgent();
  const { items: canvasItems, dismissItem: dismissCanvasItem, clearCanvas } = useCanvasData();
  const isSlowNetwork = useSlowNetwork();

  const handleEndCall = useCallback(() => {
    if (onEndCall) {
      onEndCall();
    } else {
      session.end();
    }
  }, [onEndCall, session]);

  const controls: AgentControlBarControls = {
    leave: true,
    microphone: true,
    chat: supportsChatInput,
    camera: supportsVideoInput,
    screenShare: supportsScreenShare,
  };

  // Auto-scroll chat panel
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <section
      ref={ref}
      className={cn('relative z-10 flex h-full w-full flex-col overflow-hidden', className)}
      style={{ background: 'linear-gradient(135deg, #0a0e1a 0%, #0f1629 30%, #1a2744 60%, #0d1220 100%)' }}
      {...props}
    >
      {/* ─── Trust Bar (always visible at top) ─── */}
      <InlineTrustBar />

      {/* ─── Slow Network Banner ─── */}
      <AnimatePresence>
        <SlowNetworkBanner isVisible={isSlowNetwork} />
      </AnimatePresence>

      {/* ─── Top Bar: Status + Timer + Emergency ─── */}
      <div className="relative z-20 flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3">
        {/* Left: Persona + State */}
        <div className="flex items-center gap-2">
          {selectedPersona && (
            <span className="text-lg">{selectedPersona.avatar}</span>
          )}
          <AgentStatusPill state={agentState} agentName={selectedPersona?.name} />
        </div>
        {/* Right: Timer + Emergency */}
        <div className="flex items-center gap-2">
          <InlineSessionTimer startTime={callStartTime || null} />
          <InlineEmergencyButton onClick={handleEndCall} />
        </div>
      </div>

      {/* ─── Chat Transcript (slide from left when toggled) ─── */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-y-0 left-0 z-30 flex w-[340px] flex-col overflow-hidden border-r border-white/10 bg-[#0d1220]/95 backdrop-blur-xl sm:w-[380px] md:w-[400px]"
          >
            <div className="border-b border-white/[0.06] px-4 py-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                Full Conversation
              </span>
            </div>
            <div
              ref={scrollAreaRef}
              className="flex-1 overflow-y-auto overscroll-contain scroll-smooth"
            >
              <AgentChatTranscript
                agentState={agentState}
                messages={messages}
                className="w-full [&_.is-user>div]:rounded-[22px] [&_.is-user>div]:bg-cyan-500/10 [&_.is-user>div]:border [&_.is-user>div]:border-cyan-500/20 [&>div>div]:px-4 [&>div>div]:pt-4 [&>div>div]:pb-4"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── CENTER: Audio Visualizer ─── */}
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
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

      {/* ─── Canvas Panel ─── */}
      <CanvasPanel items={canvasItems} onDismiss={dismissCanvasItem} onClear={clearCanvas} />

      {/* ─── Bottom Controls ─── */}
      <motion.div
        {...BOTTOM_VIEW_MOTION_PROPS}
        className="absolute inset-x-3 bottom-0 z-50 md:inset-x-12"
      >
        {/* Quick Actions — before first message only */}
        <AnimatePresence>
          {messages.length === 0 && (
            <motion.div key="quick-actions" {...SHIMMER_MOTION_PROPS} className="mb-3">
              <InlineQuickActions />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pre-connect shimmer */}
        {isPreConnectBufferEnabled && messages.length === 0 && (
          <AnimatePresence>
            <MotionMessage
              key="pre-connect-message"
              duration={2}
              {...SHIMMER_MOTION_PROPS}
              className="pointer-events-none mx-auto block w-full max-w-2xl pb-3 text-center text-sm font-semibold"
            >
              {preConnectMessage}
            </MotionMessage>
          </AnimatePresence>
        )}

        <div className="relative mx-auto max-w-2xl pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-12">
          <Fade bottom className="absolute inset-x-0 top-0 h-4 -translate-y-full" />
          <AgentControlBar
            variant="livekit"
            controls={controls}
            isChatOpen={chatOpen}
            isConnected={session.isConnected}
            onDisconnect={handleEndCall}
            onIsChatOpenChange={setChatOpen}
          />
        </div>
      </motion.div>
    </section>
  );
}
