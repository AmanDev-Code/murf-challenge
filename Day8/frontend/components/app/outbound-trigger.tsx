'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Phone, PhoneCall, PhoneOff, Loader2, CheckCircle2, XCircle, Delete,
  FileText, Banknote, Building2, ShieldAlert, RefreshCw,
  User, Mic, X, ClipboardList,
} from 'lucide-react';

type CallStatus = 'idle' | 'dispatching' | 'ringing' | 'connected' | 'ended' | 'error';

interface CallLog {
  role: 'agent' | 'user';
  text: string;
  time: string;
}

// Ring tone using Web Audio API
function useRingTone() {
  const ctxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const start = useCallback(() => {
    try {
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const gain = ctx.createGain();
      gain.connect(ctx.destination);

      const osc1 = ctx.createOscillator();
      osc1.frequency.value = 440;
      osc1.type = 'sine';
      osc1.connect(gain);
      osc1.start();

      const osc2 = ctx.createOscillator();
      osc2.frequency.value = 480;
      osc2.type = 'sine';
      osc2.connect(gain);
      osc2.start();

      // Ring cadence: 1s on, 2s off
      let on = true;
      gain.gain.value = 0.1;
      intervalRef.current = setInterval(() => {
        on = !on;
        gain.gain.setTargetAtTime(on ? 0.1 : 0, ctx.currentTime, 0.02);
      }, on ? 1000 : 2000);
    } catch { /* no audio context */ }
  }, []);

  const stop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (ctxRef.current) {
      try { ctxRef.current.close(); } catch {}
    }
    ctxRef.current = null;
    intervalRef.current = null;
  }, []);

  return { start, stop };
}

export function OutboundTrigger() {
  const [phone, setPhone] = useState('+91');
  const [userName, setUserName] = useState('');
  const [purpose, setPurpose] = useState('scheme_reminder');
  const [persona, setPersona] = useState('anisha');
  const [status, setStatus] = useState<CallStatus>('idle');
  const [message, setMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const ringTone = useRingTone();

  const purposes = [
    { value: 'scheme_reminder', label: 'Scheme', icon: FileText },
    { value: 'emi_reminder', label: 'EMI', icon: Banknote },
    { value: 'fd_maturity', label: 'FD', icon: Building2 },
    { value: 'scam_alert', label: 'Scam Alert', icon: ShieldAlert },
    { value: 'follow_up', label: 'Follow-up', icon: RefreshCw },
  ];

  const dialPad = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['*', '0', '#'],
  ];

  const dialSub: Record<string, string> = {
    '1': '', '2': 'ABC', '3': 'DEF',
    '4': 'GHI', '5': 'JKL', '6': 'MNO',
    '7': 'PQRS', '8': 'TUV', '9': 'WXYZ',
    '*': '', '0': '+', '#': '',
  };

  const handleKeyPress = useCallback((key: string) => {
    setPressedKey(key);
    setTimeout(() => setPressedKey(null), 120);

    if (key === 'delete') {
      setPhone((p) => (p.length > 3 ? p.slice(0, -1) : '+91'));
    } else {
      setPhone((p) => p + key);
    }
  }, []);

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (document.activeElement?.tagName === 'INPUT') return;

      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleKeyPress('delete');
      } else if (e.key === '*' || e.key === '#') {
        handleKeyPress(e.key);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, handleKeyPress]);

  const triggerCall = async () => {
    if (phone.length < 6) {
      setMessage('Enter a valid phone number');
      setStatus('error');
      return;
    }

    setStatus('dispatching');
    setMessage('Connecting...');

    try {
      const res = await fetch('/api/outbound/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: phone,
          user_name: userName || 'User',
          purpose,
          persona,
          language: 'hi',
        }),
      });

      const data = await res.json();

      if (res.ok && data.status === 'dispatched') {
        setStatus('ringing');
        setActiveRoom(data.room_name || null);
        setMessage(`Calling ${userName || phone}`);
        ringTone.start();

        // Stop ringing after 5 seconds (typical answer time)
        // Call is connected by then — agent starts speaking
        setTimeout(() => {
          ringTone.stop();
          setStatus('connected');
          setMessage(`Connected to ${userName || phone}`);
        }, 5000);
      } else {
        setStatus('error');
        setMessage(data.message || 'Failed to dispatch');
      }
    } catch {
      setStatus('error');
      setMessage('Trigger API offline');
    }
  };

  const endCall = async () => {
    ringTone.stop(); // Stop ringing sound

    if (!activeRoom) {
      setStatus('ended');
      setMessage('Call ended');
      setActiveRoom(null);
      return;
    }

    try {
      const res = await fetch('/api/outbound/hangup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_name: activeRoom }),
      });
      const data = await res.json();
      console.log('Hangup response:', data);
    } catch (err) {
      console.error('Hangup error:', err);
    }

    setStatus('ended');
    setMessage('Call ended');
    setActiveRoom(null);
  };

  // Stop ring tone when status changes away from ringing
  useEffect(() => {
    if (status !== 'ringing') {
      ringTone.stop();
    }
  }, [status, ringTone]);

  // Auto-reset UI after 60 seconds if still showing "Calling" (call ended on backend but UI didn't know)
  useEffect(() => {
    if (status === 'ringing' || status === 'connected') {
      const timer = setTimeout(() => {
        setStatus('ended');
        setMessage('Call ended');
        setActiveRoom(null);
        ringTone.stop();
      }, 120000); // 2 min max
      return () => clearTimeout(timer);
    }
  }, [status, ringTone]);

  // Floating button when closed
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 z-50 group flex items-center gap-2.5 rounded-2xl border border-[#f5a623]/20 bg-[#0d1220]/90 px-4 py-3 text-sm font-medium text-[#f5a623] shadow-xl shadow-black/30 backdrop-blur-xl transition-all duration-200 hover:border-[#f5a623]/40 hover:shadow-[#f5a623]/10 hover:scale-[1.03] active:scale-95"
        aria-label="Make outbound call"
      >
        <div className="relative">
          <PhoneCall className="h-5 w-5 transition-transform group-hover:rotate-12" />
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
        <span className="hidden sm:inline font-semibold tracking-wide">Outbound Call</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 left-6 z-50 w-[300px] rounded-3xl border border-white/[0.08] bg-[#0a0e1a]/98 shadow-2xl shadow-black/50 backdrop-blur-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f5a623]/10">
            <PhoneCall className="h-3.5 w-3.5 text-[#f5a623]" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/50">
            Dialer
          </span>
        </div>
        <button
          onClick={() => { setIsOpen(false); setStatus('idle'); setMessage(''); }}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.05] text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Phone Number Display */}
      <div className="px-5 py-3">
        <div className="flex items-center rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
          <input
            ref={inputRef}
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="flex-1 bg-transparent text-center font-mono text-lg font-semibold tracking-[0.1em] text-white focus:outline-none placeholder:text-white/20"
            placeholder="+91 XXXXX XXXXX"
          />
          <button
            onClick={() => handleKeyPress('delete')}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 transition-all hover:bg-white/10 hover:text-white/70 active:scale-90"
          >
            <Delete className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Dial Pad */}
      <div className="px-5 pb-3">
        <div className="grid grid-cols-3 gap-[6px]">
          {dialPad.flat().map((key) => (
            <button
              key={key}
              onClick={() => handleKeyPress(key)}
              className={`relative flex h-[52px] flex-col items-center justify-center rounded-xl transition-all duration-100 ${
                pressedKey === key
                  ? 'scale-[0.88] bg-[#f5a623]/25 shadow-inner'
                  : 'bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.88] active:bg-[#f5a623]/20'
              }`}
            >
              <span className={`text-[18px] font-semibold leading-none ${
                pressedKey === key ? 'text-[#f5a623]' : 'text-white/90'
              }`}>
                {key}
              </span>
              {dialSub[key] && (
                <span className="mt-0.5 text-[8px] font-medium tracking-[0.2em] text-white/25">
                  {dialSub[key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Name Input */}
      <div className="px-5 pb-2">
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <User className="h-3.5 w-3.5 text-white/30" />
          <input
            type="text"
            placeholder="Name (optional)"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className="flex-1 bg-transparent text-xs text-white placeholder:text-white/25 focus:outline-none"
          />
        </div>
      </div>

      {/* Purpose Selector */}
      <div className="px-5 pb-2">
        <div className="flex gap-[5px]">
          {purposes.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.value}
                onClick={() => setPurpose(p.value)}
                className={`flex flex-1 flex-col items-center gap-1 rounded-xl border py-2 transition-all duration-150 ${
                  purpose === p.value
                    ? 'border-[#f5a623]/40 bg-[#f5a623]/10 shadow-sm shadow-[#f5a623]/5'
                    : 'border-transparent bg-white/[0.03] hover:bg-white/[0.06]'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${
                  purpose === p.value ? 'text-[#f5a623]' : 'text-white/30'
                }`} />
                <span className={`text-[9px] font-medium leading-none ${
                  purpose === p.value ? 'text-[#f5a623]' : 'text-white/40'
                }`}>
                  {p.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Persona Selector */}
      <div className="px-5 pb-3">
        <div className="flex gap-[5px]">
          {([
            { id: 'anisha', label: 'Anisha', sub: 'Warm' },
            { id: 'samar', label: 'Samar', sub: 'Pro' },
            { id: 'pooja', label: 'Pooja', sub: 'Friendly' },
          ] as const).map((p) => (
            <button
              key={p.id}
              onClick={() => setPersona(p.id)}
              className={`flex-1 rounded-xl border py-1.5 text-center transition-all duration-150 ${
                persona === p.id
                  ? 'border-[#f5a623]/40 bg-[#f5a623]/10'
                  : 'border-transparent bg-white/[0.03] hover:bg-white/[0.06]'
              }`}
            >
              <span className={`block text-[10px] font-semibold ${
                persona === p.id ? 'text-[#f5a623]' : 'text-white/60'
              }`}>
                {p.label}
              </span>
              <span className="block text-[8px] text-white/25">{p.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Status Bar */}
      {message && (
        <div className="mx-5 mb-3 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          {status === 'dispatching' && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />}
          {status === 'ringing' && <PhoneCall className="h-3.5 w-3.5 animate-pulse text-[#f5a623]" />}
          {status === 'connected' && <Mic className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />}
          {status === 'ended' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
          {status === 'error' && <XCircle className="h-3.5 w-3.5 text-red-400" />}
          <span className="text-[11px] text-white/60">{message}</span>
        </div>
      )}

      {/* Call / End Button */}
      <div className="px-5 pb-5">
        {(status === 'ringing' || status === 'connected') ? (
          <button
            onClick={endCall}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500 py-3.5 text-sm font-bold tracking-wide text-white shadow-lg shadow-red-500/20 transition-all duration-200 active:scale-95 hover:bg-red-600"
          >
            <PhoneOff className="h-5 w-5" />
            <span>End Call</span>
          </button>
        ) : (
          <button
            onClick={triggerCall}
            disabled={status === 'dispatching'}
            className={`group relative flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold tracking-wide shadow-lg transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden bg-gradient-to-r from-[#f5a623] to-[#e8961f] text-[#0a0e1a] shadow-[#f5a623]/20 hover:shadow-[#f5a623]/30`}
          >
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            {status === 'dispatching' ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Phone className="h-5 w-5" />
            )}
            <span>{status === 'dispatching' ? 'Connecting...' : 'Call Now'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
