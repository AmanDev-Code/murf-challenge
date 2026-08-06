'use client';

import { useEffect, useState } from 'react';
import { Mic, Shield, BookOpen, AlertTriangle, IndianRupee, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VOICE_PERSONAS, type VoiceId, type VoicePersona } from '@/components/app/app';

function VoicePayLogo() {
  return (
    <div className="relative mb-2 flex items-center gap-3">
      <div className="relative">
        {/* Outer glow ring */}
        <div className="animate-pulse-ring-outer absolute inset-0 rounded-full bg-[#f5a623]/20" />
        {/* Inner glow ring */}
        <div className="animate-pulse-ring absolute inset-0 rounded-full bg-[#f5a623]/30" />
        {/* Icon container */}
        <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#f5a623] to-[#e8961f] shadow-lg shadow-[#f5a623]/30">
          <IndianRupee className="h-7 w-7 text-[#0a0e1a]" strokeWidth={2.5} />
        </div>
      </div>
      <div className="flex flex-col items-start">
        <span className="text-gold-gradient text-2xl font-bold tracking-tight">VoicePay</span>
        <span className="text-xs font-medium tracking-wider text-white/50 uppercase">Voice Banking for Bharat</span>
      </div>
    </div>
  );
}

function PulsingMicButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="relative mt-8">
      {/* Outer animated ring */}
      <div className="animate-pulse-ring-outer absolute -inset-6 rounded-full border-2 border-[#f5a623]/20" />
      {/* Middle animated ring */}
      <div className="animate-pulse-ring absolute -inset-3 rounded-full border border-[#f5a623]/30" />
      {/* Main button */}
      <button
        onClick={onClick}
        className="btn-gold-gradient animate-glow-pulse relative flex h-20 w-20 items-center justify-center rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-[#f5a623]/50"
        aria-label="Start voice conversation"
      >
        <Mic className="h-8 w-8 text-[#0a0e1a]" strokeWidth={2} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Persona Picker — compact horizontal pills
// ─────────────────────────────────────────────────────────────────────────
function PersonaPill({
  persona,
  isSelected,
  onSelect,
}: {
  persona: VoicePersona;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`group relative flex items-center gap-2 rounded-full border px-3 py-2 transition-all duration-200 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f5a623]/60 ${
        isSelected
          ? 'border-[#f5a623]/60 bg-[#f5a623]/10 shadow-md shadow-[#f5a623]/10'
          : 'border-white/10 bg-white/[0.03] hover:border-[#f5a623]/30 hover:bg-white/[0.05]'
      }`}
      aria-pressed={isSelected}
      aria-label={`Select ${persona.name} as your assistant`}
    >
      {/* Avatar */}
      <span className="text-lg">{persona.avatar}</span>

      {/* Name + tagline */}
      <div className="flex flex-col items-start">
        <span
          className={`text-xs font-semibold leading-tight transition-colors ${
            isSelected ? 'text-[#f5a623]' : 'text-white/90'
          }`}
        >
          {persona.name}
        </span>
        <span className="text-[10px] leading-tight text-white/45">{persona.tagline}</span>
      </div>

      {/* Check */}
      {isSelected && (
        <div className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-[#f5a623]">
          <Check className="h-2.5 w-2.5 text-[#0a0e1a]" strokeWidth={3} />
        </div>
      )}
    </button>
  );
}

function PersonaPicker({
  selectedVoice,
  onSelectVoice,
}: {
  selectedVoice: VoiceId;
  onSelectVoice: (voice: VoiceId) => void;
}) {
  return (
    <div className="mt-6 w-full max-w-sm">
      {/* Section header */}
      <p className="mb-2 text-center text-[10px] font-medium tracking-widest text-white/40 uppercase">
        Talk to
      </p>

      {/* Persona pills — vertical stack, compact */}
      <div className="flex flex-col gap-2">
        {VOICE_PERSONAS.map((persona) => (
          <PersonaPill
            key={persona.id}
            persona={persona}
            isSelected={selectedVoice === persona.id}
            onSelect={() => onSelectVoice(persona.id)}
          />
        ))}
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description, delay }: {
  icon: React.ElementType;
  title: string;
  description: string;
  delay: string;
}) {
  return (
    <div
      className={`animate-fade-up glass flex flex-col items-center gap-2 rounded-2xl px-5 py-5 text-center opacity-0 transition-transform duration-300 hover:scale-[1.03] hover:border-[#f5a623]/20 ${delay}`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1e3a5f]/60 ring-1 ring-white/10">
        <Icon className="h-5 w-5 text-[#f5a623]" />
      </div>
      <h3 className="text-sm font-semibold text-white/90">{title}</h3>
      <p className="text-xs leading-relaxed text-white/50">{description}</p>
    </div>
  );
}

function TrustBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-white/60 backdrop-blur-md">
      {children}
    </div>
  );
}

interface WelcomeViewProps {
  startButtonText: string;
  onStartCall: () => void;
  selectedVoice: VoiceId;
  onSelectVoice: (voice: VoiceId) => void;
}

export const WelcomeView = ({
  startButtonText,
  onStartCall,
  selectedVoice,
  onSelectVoice,
  ref,
}: React.ComponentProps<'div'> & WelcomeViewProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div ref={ref} className="relative flex min-h-svh w-full flex-col items-center overflow-y-auto overflow-x-hidden py-12">
      {/* Animated gradient background */}
      <div className="vp-gradient-bg fixed inset-0 -z-20" />

      {/* Mesh gradient overlay */}
      <div className="mesh-gradient" />

      {/* Floating decorative particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[10%] top-[20%] h-1 w-1 animate-float rounded-full bg-[#f5a623]/40 delay-100" />
        <div className="absolute left-[80%] top-[30%] h-1.5 w-1.5 animate-float rounded-full bg-[#2a5298]/50 delay-300" />
        <div className="absolute left-[60%] top-[70%] h-1 w-1 animate-float rounded-full bg-[#f5a623]/30 delay-500" />
        <div className="absolute left-[25%] top-[60%] h-2 w-2 animate-float rounded-full bg-[#1e3a5f]/60 delay-700" />
        <div className="absolute left-[75%] top-[80%] h-1 w-1 animate-float rounded-full bg-[#ffd700]/30 delay-200" />
      </div>

      {/* Main content */}
      <div className={`relative z-10 flex flex-col items-center px-6 transition-all duration-1000 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
        {/* Logo */}
        <VoicePayLogo />

        {/* Tagline */}
        <p className="mt-4 max-w-md text-center text-base leading-relaxed text-white/70 md:text-lg">
          Your AI-powered voice banking assistant.
          <br />
          <span className="text-white/90 font-medium">Just speak — we handle the rest.</span>
        </p>

        {/* ─── Persona Picker ─── */}
        <PersonaPicker selectedVoice={selectedVoice} onSelectVoice={onSelectVoice} />

        {/* CTA - Pulsing Mic */}
        <PulsingMicButton onClick={onStartCall} />

        {/* Start text */}
        <p className="mt-4 text-sm font-medium tracking-wide text-[#f5a623]/90">
          Tap to start talking
        </p>

        {/* OR text button */}
        <Button
          size="lg"
          onClick={onStartCall}
          className="btn-gold-gradient mt-3 rounded-full border-0 px-8 py-3 text-sm font-bold tracking-wide uppercase shadow-xl shadow-[#f5a623]/20"
        >
          {startButtonText}
        </Button>

        {/* Feature cards */}
        <div className="mt-10 grid w-full max-w-lg grid-cols-3 gap-3 md:gap-4">
          <FeatureCard
            icon={IndianRupee}
            title="UPI Help"
            description="Send money, check balance, UPI setup"
            delay="delay-200"
          />
          <FeatureCard
            icon={BookOpen}
            title="Financial Literacy"
            description="Learn savings, budgeting, investments"
            delay="delay-400"
          />
          <FeatureCard
            icon={AlertTriangle}
            title="Scam Protection"
            description="Identify fraud, stay safe online"
            delay="delay-600"
          />
        </div>

        {/* Trust signals */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <TrustBadge>
            <Shield className="h-3.5 w-3.5 text-emerald-400" />
            <span>Your conversation is private</span>
          </TrustBadge>
          <TrustBadge>
            <svg className="h-3.5 w-3.5 text-[#f5a623]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Powered by Murf Falcon</span>
          </TrustBadge>
        </div>
      </div>

      {/* Bottom subtle attribution */}
      <div className="absolute bottom-6 left-0 flex w-full items-center justify-center">
        <p className="text-xs text-white/30">
          Built for Bharat with care
        </p>
      </div>
    </div>
  );
};
