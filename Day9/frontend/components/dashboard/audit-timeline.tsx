'use client';

import { motion } from 'motion/react';
import { cn } from '@/lib/shadcn/utils';

export type AuditEntry = {
  action: string;
  actor?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

const ACTION_COLOR: Record<string, string> = {
  created: '#22c55e',
  status_change: '#3b82f6',
  assigned: '#a855f7',
  note_added: '#6b7280',
  callback_triggered: '#f5a623',
};

function formatTimestamp(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function humanize(v?: string | null): string {
  if (!v) return '—';
  return v.replace(/_/g, ' ');
}

function describe(e: AuditEntry): React.ReactNode {
  const actor = e.actor || 'System';
  switch (e.action) {
    case 'created':
      return (
        <>
          <span className="font-medium text-white/90">{actor}</span> created the ticket
        </>
      );
    case 'status_change':
      return (
        <>
          <span className="font-medium text-white/90">{actor}</span> changed status from{' '}
          <span className="text-white/60">{humanize(e.old_value)}</span> to{' '}
          <span className="text-white/90">{humanize(e.new_value)}</span>
        </>
      );
    case 'assigned':
      return (
        <>
          <span className="font-medium text-white/90">{actor}</span> assigned to{' '}
          <span className="text-white/90">{humanize(e.new_value) || 'unassigned'}</span>
        </>
      );
    case 'note_added':
      return (
        <>
          <span className="font-medium text-white/90">{actor}</span> added a note
        </>
      );
    case 'callback_triggered':
      return (
        <>
          <span className="font-medium text-white/90">{actor}</span> triggered a callback
        </>
      );
    default:
      return (
        <>
          <span className="font-medium text-white/90">{actor}</span> · {humanize(e.action)}
        </>
      );
  }
}

export function AuditTimeline({ audit_log }: { audit_log: AuditEntry[] }) {
  const entries = audit_log ?? [];

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/5 p-4 backdrop-blur-sm">
      <h3 className="mb-3 text-sm font-semibold text-white/90">Activity</h3>

      {entries.length === 0 ? (
        <p className="text-xs text-white/40">No activity yet.</p>
      ) : (
        <ol className="space-y-0">
          {entries.map((entry, i) => {
            const color = ACTION_COLOR[entry.action] ?? '#6b7280';
            const isLast = i === entries.length - 1;
            return (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.25 }}
                className="flex items-start gap-3"
              >
                <div className="w-14 shrink-0 pt-1 text-right text-[10px] leading-tight text-white/40">
                  {formatTimestamp(entry.created_at)}
                </div>

                <div
                  className={cn(
                    'relative flex shrink-0 flex-col items-center',
                    !isLast && 'pb-3'
                  )}
                >
                  <span
                    className="mt-1.5 size-2.5 rounded-full"
                    style={{
                      backgroundColor: color,
                      boxShadow: `0 0 0 3px rgba(10,14,26,0.9), 0 0 8px ${color}66`,
                    }}
                  />
                  {!isLast && (
                    <div className="mt-1 min-h-[16px] w-px flex-1 bg-white/[0.08]" />
                  )}
                </div>

                <div className={cn('min-w-0 flex-1', !isLast && 'pb-3')}>
                  <div className="text-sm text-white/70">{describe(entry)}</div>
                  {entry.notes && (
                    <div className="mt-1 rounded-md border border-white/[0.06] bg-black/20 px-2 py-1 text-xs whitespace-pre-wrap text-white/50">
                      {entry.notes}
                    </div>
                  )}
                </div>
              </motion.li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
