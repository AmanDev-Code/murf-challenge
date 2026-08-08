'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { AnimatePresence, motion } from 'motion/react';
import { useAgent, useSessionContext } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import type { VoiceId } from '@/components/app/app';
import { VOICE_PERSONAS } from '@/components/app/app';
import { AgentSessionView_01 } from '@/components/agents-ui/blocks/agent-session-view-01';
import { WelcomeView } from '@/components/app/welcome-view';
import { VoiceSwitcher } from '@/components/app/voice-switcher';
import { ConnectingView } from '@/components/app/connecting-view';
import { CallEndedView } from '@/components/app/call-ended-view';
import { MicPermissionGate } from '@/components/app/mic-permission-gate';
import { ConsentModal } from '@/components/app/consent-modal';
import type { Locale } from '@/lib/i18n';

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

// ─────────────────────────────────────────────────────────────────────────
// App states: ready → connecting → consent → active → ended
// ─────────────────────────────────────────────────────────────────────────
type AppState = 'ready' | 'connecting' | 'consent' | 'active' | 'ended';

interface ViewControllerProps {
  appConfig: AppConfig;
  selectedVoice: VoiceId;
  onSelectVoice: (voice: VoiceId) => void;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}

export function ViewController({
  appConfig,
  selectedVoice,
  onSelectVoice,
  locale,
  onLocaleChange,
}: ViewControllerProps) {
  const { isConnected, start, end } = useSessionContext();
  const { resolvedTheme } = useTheme();
  const { state: agentState } = useAgent();

  const [appState, setAppState] = useState<AppState>('ready');
  const [consentGiven, setConsentGiven] = useState(false);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [callTopics, setCallTopics] = useState<string[]>([]);
  const topicsRef = useRef<Set<string>>(new Set());

  // Track connection state changes
  useEffect(() => {
    if (isConnected && appState === 'connecting') {
      if (consentGiven) {
        setAppState('active');
        setCallStartTime(Date.now());
      } else {
        setAppState('consent');
      }
    } else if (!isConnected && appState === 'active') {
      // Disconnected during active call
      const duration = callStartTime ? Math.floor((Date.now() - callStartTime) / 1000) : 0;
      setCallDuration(duration);
      setCallTopics(Array.from(topicsRef.current));
      setAppState('ended');
    }
  }, [isConnected, appState, consentGiven, callStartTime]);

  // Track topics from agent state changes
  useEffect(() => {
    if (agentState === 'speaking') {
      // Agent is responding — we could parse topics from messages
      // For now, add generic banking topics based on session activity
    }
  }, [agentState]);

  const handleStartCall = useCallback(() => {
    setAppState('connecting');
    start();
  }, [start]);

  const handleCancelConnect = useCallback(() => {
    end();
    setAppState('ready');
  }, [end]);

  const handleConsent = useCallback(() => {
    setConsentGiven(true);
    setAppState('active');
    setCallStartTime(Date.now());
  }, []);

  const handleConsentTextMode = useCallback(() => {
    // Still connect but in text-only mode (future)
    setConsentGiven(true);
    setAppState('active');
    setCallStartTime(Date.now());
  }, []);

  const handleEndCall = useCallback(() => {
    const duration = callStartTime ? Math.floor((Date.now() - callStartTime) / 1000) : 0;
    setCallDuration(duration);
    setCallTopics(Array.from(topicsRef.current));
    end();
    setAppState('ended');
  }, [end, callStartTime]);

  const handleStartNewCall = useCallback(() => {
    topicsRef.current.clear();
    setCallDuration(0);
    setCallTopics([]);
    setCallStartTime(null);
    setAppState('ready');
  }, []);

  const selectedPersona = VOICE_PERSONAS.find((p) => p.id === selectedVoice) || VOICE_PERSONAS[0];

  return (
    <MicPermissionGate locale={locale}>
      <AnimatePresence mode="wait">
        {/* ─── Ready State ─── */}
        {appState === 'ready' && (
          <MotionWelcomeView
            key="welcome"
            {...VIEW_MOTION_PROPS}
            startButtonText={appConfig.startButtonText}
            onStartCall={handleStartCall}
            selectedVoice={selectedVoice}
            onSelectVoice={onSelectVoice}
            locale={locale}
            onLocaleChange={onLocaleChange}
          />
        )}

        {/* ─── Connecting State ─── */}
        {appState === 'connecting' && (
          <motion.div key="connecting" {...VIEW_MOTION_PROPS} className="fixed inset-0 z-50">
            <ConnectingView
              onCancel={handleCancelConnect}
              agentName={selectedPersona.name}
              locale={locale}
            />
          </motion.div>
        )}

        {/* ─── Active Session ─── */}
        {(appState === 'active' || appState === 'consent') && (
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
              locale={locale}
              selectedPersona={selectedPersona}
              callStartTime={callStartTime}
              onEndCall={handleEndCall}
            />
            {/* In-session voice switcher */}
            <VoiceSwitcher
              selectedVoice={selectedVoice}
              onSelectVoice={onSelectVoice}
            />
            {/* Consent modal overlay */}
            <ConsentModal
              isOpen={appState === 'consent'}
              onAgree={handleConsent}
              onTextMode={handleConsentTextMode}
              locale={locale}
            />
          </>
        )}

        {/* ─── Call Ended State ─── */}
        {appState === 'ended' && (
          <motion.div key="ended" {...VIEW_MOTION_PROPS} className="fixed inset-0 z-50">
            <CallEndedView
              duration={callDuration}
              topics={callTopics.length > 0 ? callTopics : ['Banking', 'General Inquiry']}
              actionsCount={callTopics.length}
              language="Hinglish"
              onStartNewCall={handleStartNewCall}
              locale={locale}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </MicPermissionGate>
  );
}
