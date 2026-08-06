'use client';

import { useCallback, useMemo, useState } from 'react';
import { TokenSource } from 'livekit-client';
import { useSession } from '@livekit/components-react';
import { WarningIcon } from '@phosphor-icons/react/dist/ssr';
import type { AppConfig } from '@/app-config';
import { AgentSessionProvider } from '@/components/agents-ui/agent-session-provider';
import { StartAudioButton } from '@/components/agents-ui/start-audio-button';
import { ViewController } from '@/components/app/view-controller';
import { Toaster } from '@/components/ui/sonner';
import { useAgentErrors } from '@/hooks/useAgentErrors';
import { useDebugMode } from '@/hooks/useDebug';
import { getSandboxTokenSource } from '@/lib/utils';

const IN_DEVELOPMENT = process.env.NODE_ENV !== 'production';

function AppSetup() {
  useDebugMode({ enabled: IN_DEVELOPMENT });
  useAgentErrors();

  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// Voice personas (matches backend VOICE_PERSONAS keys)
// ─────────────────────────────────────────────────────────────────────────
export type VoiceId = 'anisha' | 'samar' | 'pooja';

export interface VoicePersona {
  id: VoiceId;
  name: string;
  tagline: string;
  description: string;
  gender: 'female' | 'male';
  avatar: string; // emoji-based avatar for now
  languages: string;
}

export const VOICE_PERSONAS: VoicePersona[] = [
  {
    id: 'anisha',
    name: 'Anisha',
    tagline: 'Warm & Trustworthy',
    description: 'A caring, patient voice that makes banking feel like talking to a trusted friend.',
    gender: 'female',
    avatar: '👩🏽',
    languages: 'English, Hindi, Tamil, Bengali + 8 more',
  },
  {
    id: 'samar',
    name: 'Samar',
    tagline: 'Confident & Professional',
    description: 'A knowledgeable banker who explains complex finance in simple terms.',
    gender: 'male',
    avatar: '👨🏽',
    languages: 'English, Hindi, Kannada, Telugu + 3 more',
  },
  {
    id: 'pooja',
    name: 'Pooja',
    tagline: 'Friendly & Bilingual',
    description: 'Switches seamlessly between Hindi and English — perfect for Hinglish.',
    gender: 'female',
    avatar: '👩🏽‍💼',
    languages: 'English, Hindi',
  },
];

interface AppProps {
  appConfig: AppConfig;
}

export function App({ appConfig }: AppProps) {
  const [selectedVoice, setSelectedVoice] = useState<VoiceId>('anisha');

  // Custom token source that includes the selected voice in the request body.
  const tokenSource = useMemo(() => {
    if (typeof process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT === 'string') {
      return getSandboxTokenSource(appConfig);
    }

    return TokenSource.custom(async (options) => {
      const res = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voice: selectedVoice,
          // Pass through standard LiveKit fields if present
          ...(options.agentName && {
            room_config: { agents: [{ agentName: options.agentName }] },
          }),
        }),
      });

      if (!res.ok) {
        throw new Error(`Token request failed: ${res.status}`);
      }

      const data = await res.json();
      return {
        serverUrl: data.serverUrl,
        participantToken: data.participantToken,
      };
    });
  }, [appConfig, selectedVoice]);

  const session = useSession(
    tokenSource,
    appConfig.agentName ? { agentName: appConfig.agentName } : undefined
  );

  const handleSelectVoice = useCallback((voice: VoiceId) => {
    setSelectedVoice(voice);
  }, []);

  return (
    <AgentSessionProvider session={session}>
      <AppSetup />
      <main className="grid h-svh grid-cols-1 place-content-center bg-[#0a0e1a]">
        <ViewController
          appConfig={appConfig}
          selectedVoice={selectedVoice}
          onSelectVoice={handleSelectVoice}
        />
      </main>
      <StartAudioButton label="Start Audio" />
      <Toaster
        icons={{
          warning: <WarningIcon weight="bold" />,
        }}
        position="top-center"
        className="toaster group"
        style={
          {
            '--normal-bg': 'var(--popover)',
            '--normal-text': 'var(--popover-foreground)',
            '--normal-border': 'var(--border)',
          } as React.CSSProperties
        }
      />
    </AgentSessionProvider>
  );
}
