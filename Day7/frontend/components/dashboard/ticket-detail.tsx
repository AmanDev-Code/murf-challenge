'use client';

import { ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/shadcn/utils';
import { AuditTimeline, type AuditEntry } from './audit-timeline';
import { ConversationLog, type ConversationMessage } from './conversation-log';
import { ResolutionForm, type ResolutionData } from './resolution-form';

const URGENCY_COLOR: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

const STATUS_COLOR: Record<string, string> = {
  open: '#eab308',
  in_progress: '#3b82f6',
  awaiting_callback: '#a855f7',
  resolved: '#22c55e',
  closed: '#6b7280',
};

const TYPE_COLOR: Record<string, string> = {
  fraud: '#ef4444',
  regulatory: '#3b82f6',
};

function labelize(v?: string): string {
  if (!v) return '—';
  return v
    .split('_')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium"
      style={{
        backgroundColor: `${color}1a`,
        color,
        border: `1px solid ${color}33`,
      }}
    >
      {label}
    </span>
  );
}

export type TicketDetailEscalation = {
  reference_id?: string;
  type?: string;
  urgency?: string;
  status?: string;
  caller?: string | null;
  caller_name?: string | null;
  assigned_to?: string | null;
  resolution_notes?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
};

export type TicketDetailProps = {
  escalation: TicketDetailEscalation;
  messages: ConversationMessage[];
  audit_log: AuditEntry[];
  onBack: () => void;
  onResolve: (data: ResolutionData) => void;
  onCallback: () => void;
};

export function TicketDetail({
  escalation,
  messages,
  audit_log,
  onBack,
  onResolve,
  onCallback,
}: TicketDetailProps) {
  const type = escalation.type ?? '';
  const urgency = escalation.urgency ?? '';
  const status = escalation.status ?? '';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      <div>
        <button
          type="button"
          onClick={onBack}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm',
            'border border-white/[0.08] bg-white/5 text-white/70',
            'transition-colors hover:border-white/20 hover:text-white/90'
          )}
        >
          <ArrowLeft className="size-4" />
          Back to tickets
        </button>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-white/5 p-5 backdrop-blur-sm">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <div className="mb-1 text-[10px] font-medium tracking-wider text-white/40 uppercase">
              Reference
            </div>
            <div className="truncate font-mono text-xl font-medium text-white/90">
              {escalation.reference_id ?? '—'}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {type && <Badge label={labelize(type)} color={TYPE_COLOR[type] ?? '#6b7280'} />}
            {urgency && (
              <Badge label={labelize(urgency)} color={URGENCY_COLOR[urgency] ?? '#6b7280'} />
            )}
            {status && (
              <Badge label={labelize(status)} color={STATUS_COLOR[status] ?? '#6b7280'} />
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-white/[0.06] pt-4 text-sm sm:grid-cols-3">
          <div>
            <div className="text-[10px] font-medium tracking-wider text-white/40 uppercase">
              Caller
            </div>
            <div className="mt-0.5 truncate text-white/80">
              {escalation.caller_name || escalation.caller || '—'}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium tracking-wider text-white/40 uppercase">
              Assigned
            </div>
            <div className="mt-0.5 truncate text-white/80">
              {escalation.assigned_to || (
                <span className="text-white/40">Unassigned</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium tracking-wider text-white/40 uppercase">
              Created
            </div>
            <div className="mt-0.5 truncate text-white/80">
              {escalation.created_at
                ? new Date(escalation.created_at).toLocaleString()
                : '—'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ConversationLog messages={messages} />
        </div>
        <div className="space-y-4 lg:col-span-2">
          <ResolutionForm
            escalation={escalation}
            onResolve={onResolve}
            onCallback={onCallback}
          />
          <AuditTimeline audit_log={audit_log} />
        </div>
      </div>
    </motion.div>
  );
}
