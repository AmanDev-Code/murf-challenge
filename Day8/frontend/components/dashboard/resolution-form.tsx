'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, PhoneCall, Save } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/shadcn/utils';

export type ResolutionStatus = 'in_progress' | 'resolved' | 'closed';

export type ResolutionData = {
  status: ResolutionStatus;
  assigned_to: string;
  resolution_notes: string;
};

type EscalationLike = {
  reference_id?: string;
  status?: string;
  assigned_to?: string | null;
  resolution_notes?: string | null;
  urgency?: string;
};

const STATUS_OPTIONS: { value: ResolutionStatus; label: string }[] = [
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolve' },
  { value: 'closed', label: 'Close' },
];

export function ResolutionForm({
  escalation,
  onResolve,
  onCallback,
}: {
  escalation: EscalationLike;
  onResolve: (data: ResolutionData) => void;
  onCallback: () => void;
}) {
  const initialStatus = useMemo<ResolutionStatus>(() => {
    if (
      escalation.status === 'in_progress' ||
      escalation.status === 'resolved' ||
      escalation.status === 'closed'
    ) {
      return escalation.status;
    }
    return 'in_progress';
  }, [escalation.status]);

  const [status, setStatus] = useState<ResolutionStatus>(initialStatus);
  const [assignedTo, setAssignedTo] = useState<string>(escalation.assigned_to ?? '');
  const [notes, setNotes] = useState<string>(escalation.resolution_notes ?? '');

  const isResolving = status === 'resolved';
  const missingNotes = isResolving && notes.trim().length === 0;

  const submit = (triggerCallback: boolean) => {
    const payload: ResolutionData = {
      status,
      assigned_to: assignedTo.trim(),
      resolution_notes: notes.trim(),
    };
    onResolve(payload);
    if (triggerCallback && isResolving) {
      onCallback();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4 rounded-xl border border-white/[0.08] bg-white/5 p-4 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/90">Resolution</h3>
        {escalation.reference_id && (
          <span className="font-mono text-[10px] text-white/40">
            {escalation.reference_id}
          </span>
        )}
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="text-[10px] font-medium tracking-wider text-white/40 uppercase">
            Status
          </span>
          <div className="relative mt-1">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ResolutionStatus)}
              className={cn(
                'w-full appearance-none rounded-lg px-3 py-2 pr-8 text-sm',
                'border border-white/[0.08] bg-white/5 backdrop-blur-sm',
                'cursor-pointer text-white/90',
                'transition-colors focus:border-[#f5a623]/60 focus:ring-1 focus:ring-[#f5a623]/40 focus:outline-none'
              )}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} className="bg-[#0a0e1a] text-white/90">
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-white/40" />
          </div>
        </label>

        <label className="block">
          <span className="text-[10px] font-medium tracking-wider text-white/40 uppercase">
            Assigned to
          </span>
          <input
            type="text"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            placeholder="Team or agent name"
            className={cn(
              'mt-1 w-full rounded-lg px-3 py-2 text-sm',
              'border border-white/[0.08] bg-white/5 backdrop-blur-sm',
              'text-white/90 placeholder:text-white/30',
              'transition-colors focus:border-[#f5a623]/60 focus:ring-1 focus:ring-[#f5a623]/40 focus:outline-none'
            )}
          />
        </label>

        <label className="block">
          <span className="text-[10px] font-medium tracking-wider text-white/40 uppercase">
            Resolution notes
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe the resolution..."
            rows={5}
            className={cn(
              'mt-1 w-full resize-y rounded-lg px-3 py-2 text-sm',
              'border border-white/[0.08] bg-white/5 backdrop-blur-sm',
              'text-white/90 placeholder:text-white/30',
              'transition-colors focus:border-[#f5a623]/60 focus:ring-1 focus:ring-[#f5a623]/40 focus:outline-none'
            )}
          />
        </label>

        {missingNotes && (
          <div className="flex items-start gap-2 rounded-lg border border-[#eab308]/30 bg-[#eab308]/10 px-3 py-2 text-xs text-[#eab308]">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>Add resolution notes before marking this ticket resolved.</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 pt-1 sm:flex-row">
        {isResolving && (
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={missingNotes}
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold',
              'bg-gradient-to-r from-[#f5a623] to-[#ffd700] text-[#0a0e1a]',
              'shadow-[0_4px_24px_-8px_rgba(245,166,35,0.7)]',
              'transition-all hover:brightness-110',
              'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100'
            )}
          >
            <PhoneCall className="size-4" />
            Resolve & Notify
          </button>
        )}
        <button
          type="button"
          onClick={() => submit(false)}
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm',
            'border border-white/[0.12] bg-white/5 text-white/80',
            'transition-colors hover:border-white/25 hover:bg-white/10'
          )}
        >
          <Save className="size-4" />
          Update
        </button>
      </div>
    </motion.div>
  );
}
