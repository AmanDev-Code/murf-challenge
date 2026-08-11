'use client';

import { useState } from 'react';
import { Clock, Download, MessageSquare, RotateCcw, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CallEndedViewProps {
  duration: number;
  topics: string[];
  actionsCount: number;
  language: string;
  onStartNewCall: () => void;
  onSaveTranscript?: () => void;
  locale?: 'en' | 'hi';
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="glass flex flex-col items-center gap-2 rounded-xl px-4 py-4 text-center">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1e3a5f]/60 ring-1 ring-white/10">
        <Icon className="h-4 w-4 text-[#f5a623]" />
      </div>
      <p className="text-sm font-semibold text-white/90">{value}</p>
      <p className="text-xs text-white/50">{label}</p>
    </div>
  );
}

function StarRating() {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs font-medium tracking-wider text-white/40 uppercase">Rate this call</p>
      <div className="flex gap-1" role="group" aria-label="Rate this call from 1 to 5 stars">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            className="rounded-md p-1 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f5a623]/60"
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            aria-pressed={rating >= star}
          >
            <Star
              className={`h-6 w-6 transition-colors ${
                star <= (hovered || rating)
                  ? 'fill-[#f5a623] text-[#f5a623]'
                  : 'text-white/20'
              }`}
            />
          </button>
        ))}
      </div>
      {rating > 0 && (
        <p className="text-xs text-white/50">
          {rating >= 4 ? 'Thank you!' : rating >= 2 ? 'Thanks for your feedback' : "We'll do better"}
        </p>
      )}
    </div>
  );
}

export function CallEndedView({
  duration,
  topics,
  actionsCount,
  language,
  onStartNewCall,
  onSaveTranscript,
}: CallEndedViewProps) {
  return (
    <div className="vp-gradient-bg relative flex min-h-svh w-full flex-col items-center justify-center overflow-y-auto px-6 py-12">
      {/* Mesh gradient overlay */}
      <div className="mesh-gradient" />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-8">
        {/* Header */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 ring-1 ring-emerald-500/30">
            <svg
              className="h-6 w-6 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white/90">Call Completed</h2>
          <p className="text-sm text-white/50">Here&apos;s your session summary</p>
        </div>

        {/* Stats grid */}
        <div className="grid w-full grid-cols-2 gap-3">
          <StatCard icon={Clock} label="Duration" value={formatDuration(duration)} />
          <StatCard
            icon={MessageSquare}
            label="Topics"
            value={`${topics.length} discussed`}
          />
          <StatCard
            icon={RotateCcw}
            label="Actions Taken"
            value={actionsCount.toString()}
          />
          <StatCard
            icon={MessageSquare}
            label="Language"
            value={language}
          />
        </div>

        {/* Topics list */}
        {topics.length > 0 && (
          <div className="glass w-full rounded-xl px-5 py-4">
            <p className="mb-3 text-xs font-medium tracking-wider text-white/40 uppercase">
              Topics Discussed
            </p>
            <div className="flex flex-wrap gap-2">
              {topics.map((topic) => (
                <span
                  key={topic}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/70"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Star rating */}
        <StarRating />

        {/* Actions */}
        <div className="flex w-full flex-col items-center gap-3">
          <Button
            size="lg"
            onClick={onStartNewCall}
            className="btn-gold-gradient w-full rounded-full border-0 px-8 py-3 text-sm font-bold tracking-wide uppercase shadow-xl shadow-[#f5a623]/20"
            aria-label="Start a new call"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Start New Call
          </Button>

          {onSaveTranscript && (
            <Button
              variant="ghost"
              onClick={onSaveTranscript}
              className="w-full gap-2 rounded-full border border-white/10 text-sm text-white/60 hover:border-white/20 hover:text-white/80"
              aria-label="Save transcript"
            >
              <Download className="h-4 w-4" />
              Save Transcript
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
