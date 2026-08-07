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

// ─────────────────────────────────────────────────────────────────────────
// Agent Status Pill — shows current state with animation
// ─────────────────────────────────────────────────────────────────────────
function AgentStatusPill({ state }: { state: string }) {
  const isListening = state === 'listening' || state === 'idle';
  const isSpeaking = state === 'speaking';
  const isThinking = state === 'thinking' || state === 'processing';

  let label = 'VoicePay';
  let statusColor = 'bg-emerald-400';
  let Icon = Sparkles;

  if (isListening) {
    label = 'Listening...';
    statusColor = 'bg-emerald-400';
    Icon = Mic;
  } else if (isSpeaking) {
    label = 'Speaking';
    statusColor = 'bg-[#f5a623]';
    Icon = Sparkles;
  } else if (isThinking) {
    label = 'Thinking...';
    statusColor = 'bg-blue-400';
    Icon = Sparkles;
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 backdrop-blur-xl">
      {/* Animated dot */}
      <span className="relative flex h-2 w-2">
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${statusColor}`}
        />
        <span className={`relative inline-flex h-2 w-2 rounded-full ${statusColor}`} />
      </span>
      <Icon className="h-3 w-3 text-white/60" />
      <span className="text-[11px] font-medium text-white/70">{label}</span>
    </div>
  );
}

export interface AgentSessionView_01Props {
  /**
   * Message shown above the controls before the first chat message is sent.
   *
   * @default 'Agent is listening, ask it a question'
   */
  preConnectMessage?: string;
  /**
   * Enables or disables the chat toggle and transcript input controls.
   *
   * @default true
   */
  supportsChatInput?: boolean;
  /**
   * Enables or disables camera controls in the bottom control bar.
   *
   * @default true
   */
  supportsVideoInput?: boolean;
  /**
   * Enables or disables screen sharing controls in the bottom control bar.
   *
   * @default true
   */
  supportsScreenShare?: boolean;
  /**
   * Shows a pre-connect buffer state with a shimmer message before messages appear.
   *
   * @default true
   */
  isPreConnectBufferEnabled?: boolean;

  /** Selects the visualizer style rendered in the main tile area. */
  audioVisualizerType?: 'bar' | 'wave' | 'grid' | 'radial' | 'aura';
  /** Primary hex color used by supported audio visualizer variants. */
  audioVisualizerColor?: `#${string}`;
  /** Hue shift intensity used by certain visualizers. */
  audioVisualizerColorShift?: number;
  /** Number of bars to render when `audioVisualizerType` is `bar`. */
  audioVisualizerBarCount?: number;
  /** Number of rows in the visualizer when `audioVisualizerType` is `grid`. */
  audioVisualizerGridRowCount?: number;
  /** Number of columns in the visualizer when `audioVisualizerType` is `grid`. */
  audioVisualizerGridColumnCount?: number;
  /** Number of radial bars when `audioVisualizerType` is `radial`. */
  audioVisualizerRadialBarCount?: number;
  /** Base radius of the radial visualizer when `audioVisualizerType` is `radial`. */
  audioVisualizerRadialRadius?: number;
  /** Stroke width of the wave path when `audioVisualizerType` is `wave`. */
  audioVisualizerWaveLineWidth?: number;
  /** Optional class name merged onto the outer `<section>` container. */
  className?: string;
}

export function AgentSessionView_01({
  preConnectMessage = 'Agent is listening, ask it a question',
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
  ...props
}: React.ComponentProps<'section'> & AgentSessionView_01Props) {
  const session = useSessionContext();
  const { messages } = useSessionMessages(session);
  const [chatOpen, setChatOpen] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { state: agentState } = useAgent();
  const { items: canvasItems, dismissItem: dismissCanvasItem, clearCanvas } = useCanvasData();

  const controls: AgentControlBarControls = {
    leave: true,
    microphone: true,
    chat: supportsChatInput,
    camera: supportsVideoInput,
    screenShare: supportsScreenShare,
  };

  // Auto-scroll to bottom when new messages arrive
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
      {/* ─── Top Bar: Agent Status ─── */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-center pt-4">
        <AgentStatusPill state={agentState} />
      </div>

      <Fade top className="absolute inset-x-4 top-0 z-10 h-40" />

      {/* ─── LEFT: Chat Transcript Area — slides from left ─── */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            {...CHAT_MOTION_PROPS}
            className="absolute inset-y-0 left-0 z-30 flex w-[340px] flex-col overflow-hidden border-r border-white/10 bg-[#0d1220]/95 backdrop-blur-xl sm:w-[380px] md:w-[400px]"
          >
            <div className="border-b border-white/[0.06] px-4 py-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                Conversation
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

      {/* ─── CENTER: Tile Layout (audio visualizer) ─── */}
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
            {messages.length === 0 && (
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
        <div className="relative mx-auto max-w-2xl pb-3 md:pb-12">
          <Fade bottom className="absolute inset-x-0 top-0 h-4 -translate-y-full" />
          <AgentControlBar
            variant="livekit"
            controls={controls}
            isChatOpen={chatOpen}
            isConnected={session.isConnected}
            onDisconnect={session.end}
            onIsChatOpenChange={setChatOpen}
          />
        </div>
      </motion.div>
    </section>
  );
}
