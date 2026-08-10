'use client';

import { useState } from 'react';
import { useSessionContext } from '@livekit/components-react';
import { Check, Users } from 'lucide-react';
import { VOICE_PERSONAS, type VoiceId } from '@/components/app/app';

interface VoiceSwitcherProps {
  selectedVoice: VoiceId;
  onSelectVoice: (voice: VoiceId) => void;
}

/**
 * Floating in-session voice switcher.
 * Shows a small button that expands into a compact persona picker overlay.
 * When user switches, it sends a data message to the LiveKit room so the
 * backend agent can hot-swap the TTS voice mid-conversation.
 */
export function VoiceSwitcher({ selectedVoice, onSelectVoice }: VoiceSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { room } = useSessionContext();

  const handleSelect = async (voiceId: VoiceId) => {
    if (voiceId === selectedVoice) {
      setIsOpen(false);
      return;
    }

    onSelectVoice(voiceId);
    setIsOpen(false);

    // Send voice switch command to the backend via LiveKit data channel.
    // The backend agent listens for this and hot-swaps TTS config.
    try {
      const encoder = new TextEncoder();
      const payload = encoder.encode(JSON.stringify({ type: 'voice_switch', voice: voiceId }));
      await room?.localParticipant?.publishData(payload, { reliable: true });
    } catch (e) {
      console.warn('Failed to send voice switch message:', e);
    }
  };

  const currentPersona = VOICE_PERSONAS.find((p) => p.id === selectedVoice);

  return (
    <div className="fixed bottom-24 right-4 z-50 md:bottom-8 md:right-8">
      {/* Expanded picker */}
      {isOpen && (
        <div className="glass-strong absolute bottom-14 right-0 mb-2 flex w-56 flex-col gap-1 rounded-2xl p-2 shadow-2xl shadow-black/40">
          <p className="px-2 pt-1 pb-1.5 text-[10px] font-medium tracking-widest text-white/40 uppercase">
            Switch voice
          </p>
          {VOICE_PERSONAS.map((persona) => (
            <button
              key={persona.id}
              onClick={() => handleSelect(persona.id)}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors ${
                selectedVoice === persona.id
                  ? 'bg-[#f5a623]/10 text-[#f5a623]'
                  : 'text-white/80 hover:bg-white/[0.05]'
              }`}
            >
              <span className="text-base">{persona.avatar}</span>
              <div className="flex-1">
                <p className="text-xs font-semibold">{persona.name}</p>
                <p className="text-[10px] text-white/40">{persona.tagline}</p>
              </div>
              {selectedVoice === persona.id && (
                <Check className="h-3.5 w-3.5 text-[#f5a623]" strokeWidth={2.5} />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 rounded-full border px-3 py-2 shadow-lg backdrop-blur-xl transition-all duration-200 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f5a623]/60 ${
          isOpen
            ? 'border-[#f5a623]/40 bg-[#f5a623]/10'
            : 'border-white/10 bg-[#0a0e1a]/80'
        }`}
        aria-label="Switch voice assistant"
        aria-expanded={isOpen}
      >
        <span className="text-sm">{currentPersona?.avatar}</span>
        <span className="text-[11px] font-medium text-white/70">
          {currentPersona?.name}
        </span>
        <Users className="h-3 w-3 text-white/40" />
      </button>
    </div>
  );
}
