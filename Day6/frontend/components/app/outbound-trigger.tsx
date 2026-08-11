'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Phone, PhoneCall, Loader2, CheckCircle2, XCircle, Delete } from 'lucide-react';

type CallStatus = 'idle' | 'dispatching' | 'ringing' | 'connected' | 'ended' | 'error';

export function OutboundTrigger() {
  const [phone, setPhone] = useState('+91');
  const [userName, setUserName] = useState('');
  const [purpose, setPurpose] = useState('scheme_reminder');
  const [persona, setPersona] = useState('anisha');
  const [status, setStatus] = useState<CallStatus>('idle');
  const [message, setMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const purposes = [
    { value: 'scheme_reminder', label: '📋 Scheme Reminder' },
    { value: 'emi_reminder', label: '💰 EMI Reminder' },
    { value: 'fd_maturity', label: '🏦 FD Maturity' },
    { value: 'scam_alert', label: '⚠️ Scam Alert' },
    { value: 'follow_up', label: '🔄 Follow-up' },
  ];

  const dialPad = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['*', '0', '#'],
  ];

  const handleKeyPress = useCallback((key: string) => {
    setPressedKey(key);
    setTimeout(() => setPressedKey(null), 150);

    if (key === 'delete') {
      setPhone((p) => (p.length > 3 ? p.slice(0, -1) : '+91'));
    } else {
      setPhone((p) => p + key);
    }
  }, []);

  // Keyboard support — pressing number keys triggers the dial pad
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (document.activeElement === inputRef.current) return; // let input handle it

      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleKeyPress('delete');
      } else if (e.key === '*') {
        handleKeyPress('*');
      } else if (e.key === '#') {
        handleKeyPress('#');
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, handleKeyPress]);

  const triggerCall = async () => {
    if (phone.length < 6) {
      setMessage('Enter a valid phone number');
      return;
    }

    setStatus('dispatching');
    setMessage('Dispatching call...');

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
        setMessage(`📞 Calling ${userName || phone}...`);
        setTimeout(() => {
          setStatus('ended');
          setMessage('Call completed');
        }, 30000);
      } else {
        setStatus('error');
        setMessage(data.message || data.detail || 'Failed to dispatch');
      }
    } catch {
      setStatus('error');
      setMessage('Network error — is trigger API running?');
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 z-50 flex items-center gap-2 rounded-full border border-[#f5a623]/30 bg-[#f5a623]/10 px-4 py-2.5 text-sm font-medium text-[#f5a623] shadow-lg shadow-[#f5a623]/10 backdrop-blur-xl transition-all hover:bg-[#f5a623]/20 hover:scale-105"
        aria-label="Make outbound call"
      >
        <PhoneCall className="h-4 w-4" />
        <span className="hidden sm:inline">Outbound Call</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 left-6 z-50 w-[320px] overflow-hidden rounded-2xl border border-white/10 bg-[#0d1220]/98 shadow-2xl backdrop-blur-xl sm:w-[340px]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <PhoneCall className="h-4 w-4 text-[#f5a623]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-white/60">
            VoicePay Dialer
          </span>
        </div>
        <button
          onClick={() => { setIsOpen(false); setStatus('idle'); setMessage(''); }}
          className="flex h-6 w-6 items-center justify-center rounded-full text-white/40 hover:bg-white/10 hover:text-white/80"
        >
          ×
        </button>
      </div>

      {/* Phone Display */}
      <div className="border-b border-white/[0.04] px-4 py-4">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="flex-1 bg-transparent text-center text-xl font-mono font-semibold text-white tracking-wider focus:outline-none placeholder:text-white/20"
            placeholder="+91 XXXXX XXXXX"
          />
          <button
            onClick={() => handleKeyPress('delete')}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
          >
            <Delete className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Dial Pad */}
      <div className="px-4 py-3">
        <div className="grid grid-cols-3 gap-2">
          {dialPad.flat().map((key) => (
            <button
              key={key}
              onClick={() => handleKeyPress(key)}
              className={`flex h-12 items-center justify-center rounded-xl text-lg font-semibold transition-all duration-100 ${
                pressedKey === key
                  ? 'scale-90 bg-[#f5a623]/30 text-[#f5a623]'
                  : 'bg-white/[0.05] text-white/80 hover:bg-white/[0.1] active:scale-90 active:bg-[#f5a623]/20'
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      {/* Name + Purpose */}
      <div className="space-y-2 border-t border-white/[0.04] px-4 py-3">
        <input
          type="text"
          placeholder="Name (e.g. Aman)"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:border-[#f5a623]/40 focus:outline-none"
        />
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {purposes.map((p) => (
            <button
              key={p.value}
              onClick={() => setPurpose(p.value)}
              className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all ${
                purpose === p.value
                  ? 'border-[#f5a623]/50 bg-[#f5a623]/15 text-[#f5a623]'
                  : 'border-white/10 bg-white/[0.03] text-white/50 hover:text-white/80'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {(['anisha', 'samar', 'pooja'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPersona(p)}
              className={`flex-1 rounded-lg border px-2 py-1 text-[10px] font-medium transition-all ${
                persona === p
                  ? 'border-[#f5a623]/50 bg-[#f5a623]/15 text-[#f5a623]'
                  : 'border-white/10 bg-white/[0.03] text-white/40'
              }`}
            >
              {p === 'anisha' ? '👩🏽 Anisha' : p === 'samar' ? '👨🏽 Samar' : '👩🏽‍💼 Pooja'}
            </button>
          ))}
        </div>
      </div>

      {/* Status */}
      {message && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
          {status === 'dispatching' && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />}
          {status === 'ringing' && <PhoneCall className="h-3.5 w-3.5 animate-pulse text-[#f5a623]" />}
          {status === 'ended' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
          {status === 'error' && <XCircle className="h-3.5 w-3.5 text-red-400" />}
          <span className="text-[11px] text-white/70">{message}</span>
        </div>
      )}

      {/* Call Button */}
      <div className="px-4 pb-4">
        <button
          onClick={triggerCall}
          disabled={status === 'dispatching' || status === 'ringing'}
          className={`flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-bold shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
            status === 'ringing'
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-emerald-500/20'
              : 'bg-gradient-to-r from-[#f5a623] to-[#e8961f] text-[#0a0e1a] shadow-[#f5a623]/20'
          }`}
        >
          {status === 'dispatching' ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Phone className="h-5 w-5" />
          )}
          {status === 'ringing' ? 'Calling...' : status === 'dispatching' ? 'Connecting...' : 'Call Now'}
        </button>
      </div>
    </div>
  );
}
