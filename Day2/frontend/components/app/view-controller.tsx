'use client';

import { useTheme } from 'next-themes';
import { AnimatePresence, motion } from 'motion/react';
import { useSessionContext } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import type { VoiceId } from '@/components/app/app';
import { AgentSessionView_01 } from '@/components/agents-ui/blocks/agent-session-view-01';
import { WelcomeView } from '@/components/app/welcome-view';
import { VoiceSwitcher } from '@/components/app/voice-switcher';

const MotionWelcomeView = motion.create(WelcomeView);
const MotionSessionView = motion.create(AgentSessionView_01);

const VIEW_MOTION_PROPS = {
  variants: {
    visible: {
      opacity: 1,
      scale: 1,
    },
    hidden: {
      opacity: 0,
      scale: 0.98,
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
  transition: {
    duration: 0.6,
    ease: [0.22, 1, 0.36, 1],
  },
};

interface ViewControllerProps {
  appConfig: AppConfig;
  selectedVoice: VoiceId;
  onSelectVoice: (voice: VoiceId) => void;
}

export function ViewController({ appConfig, selectedVoice, onSelectVoice }: ViewControllerProps) {
  const { isConnected, start } = useSessionContext();
  const { resolvedTheme } = useTheme();

  return (
    <AnimatePresence mode="wait">
      {/* Welcome view */}
      {!isConnected && (
        <MotionWelcomeView
          key="welcome"
          {...VIEW_MOTION_PROPS}
          startButtonText={appConfig.startButtonText}
          onStartCall={start}
          selectedVoice={selectedVoice}
          onSelectVoice={onSelectVoice}
        />
      )}
      {/* Session view + floating voice switcher */}
      {isConnected && (
        <>
          <MotionSessionView
            key="session-view"
            {...VIEW_MOTION_PROPS}
            preConnectMessage="VoicePay is listening — ask me anything about banking"
            supportsChatInput={appConfig.supportsChatInput}
            supportsVideoInput={appConfig.supportsVideoInput}
            supportsScreenShare={appConfig.supportsScreenShare}
            isPreConnectBufferEnabled={appConfig.isPreConnectBufferEnabled}
            audioVisualizerType={appConfig.audioVisualizerType}
            audioVisualizerColor={
              resolvedTheme === 'dark'
                ? appConfig.audioVisualizerColorDark
                : appConfig.audioVisualizerColor
            }
            audioVisualizerColorShift={appConfig.audioVisualizerColorShift}
            audioVisualizerBarCount={appConfig.audioVisualizerBarCount}
            audioVisualizerGridRowCount={appConfig.audioVisualizerGridRowCount}
            audioVisualizerGridColumnCount={appConfig.audioVisualizerGridColumnCount}
            audioVisualizerRadialBarCount={appConfig.audioVisualizerRadialBarCount}
            audioVisualizerRadialRadius={appConfig.audioVisualizerRadialRadius}
            audioVisualizerWaveLineWidth={appConfig.audioVisualizerWaveLineWidth}
            className="fixed inset-0"
          />
          {/* In-session voice switcher — floating bottom-right */}
          <VoiceSwitcher
            selectedVoice={selectedVoice}
            onSelectVoice={onSelectVoice}
          />
        </>
      )}
    </AnimatePresence>
  );
}
