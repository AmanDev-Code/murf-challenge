'use client';

import { Shield } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/shadcn/utils';

export type EscalationRow = {
  reference_id: string;
  type: string;
  urgency: string;
  status: string;
  caller?: string | null;
  caller_name?: string | null;
  created_at?: string | null;
  assigned_to?: string | null;
};

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

function formatRelative(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const diff = Date.now() - d.getTime();
  const abs = Math.abs(diff);
  const s = Math.round(abs / 1000);
  const suffix = diff >= 0 ? 'ago' : 'from now';
  if (s < 60) return `${s}s ${suffix}`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ${suffix}`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ${suffix}`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days}d ${suffix}`;
  const mo = Math.round(days / 30);
  if (mo < 12) return `${mo}mo ${suffix}`;
  const yr = Math.round(mo / 12);
  return `${yr}y ${suffix}`;
}

function labelize(v: string): string {
  if (!v) return '—';
  return v
    .split('_')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

export function TicketList({
  escalations,
  onSelect,
}: {
  escalations: EscalationRow[];
  onSelect: (id: string) => void;
}) {
  if (!escalations || escalations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-white/5 p-12 text-center backdrop-blur-sm">
        <Shield className="mb-3 size-10 text-white/20" strokeWidth={1.5} />
        <p className="text-white/60">No escalation tickets yet</p>
        <p className="mt-1 text-sm text-white/40">
          Escalations from voice conversations will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/5 backdrop-blur-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.08] text-left">
              {[
                'Reference',
                'Type',
                'Urgency',
                'Status',
                'Caller',
                'Created',
                'Assigned To',
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-[10px] font-medium tracking-wider text-white/40 uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {escalations.map((e, i) => {
              const uColor = URGENCY_COLOR[e.urgency] ?? '#6b7280';
              const sColor = STATUS_COLOR[e.status] ?? '#6b7280';
              const tColor = TYPE_COLOR[e.type] ?? '#6b7280';
              return (
                <motion.tr
                  key={e.reference_id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.02, 0.25), duration: 0.25 }}
                  onClick={() => onSelect(e.reference_id)}
                  className={cn(
                    'group cursor-pointer border-b border-white/[0.04] transition-colors last:border-b-0',
                    'hover:bg-white/[0.03]'
                  )}
                >
                  <td className="border-l-2 border-transparent px-4 py-3 group-hover:border-[#f5a623]">
                    <span className="font-mono text-xs text-white/90">
                      {e.reference_id}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium"
                      style={{
                        backgroundColor: `${tColor}1a`,
                        color: tColor,
                        border: `1px solid ${tColor}33`,
                      }}
                    >
                      {labelize(e.type)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2 rounded-full"
                        style={{
                          backgroundColor: uColor,
                          boxShadow: `0 0 6px ${uColor}80`,
                        }}
                      />
                      <span className="text-white/80 capitalize">{e.urgency}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                      style={{
                        backgroundColor: `${sColor}1a`,
                        color: sColor,
                        border: `1px solid ${sColor}33`,
                      }}
                    >
                      {labelize(e.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/70">
                    {e.caller_name || e.caller || '—'}
                  </td>
                  <td className="px-4 py-3 text-white/50">
                    {formatRelative(e.created_at)}
                  </td>
                  <td className="px-4 py-3 text-white/70">
                    {e.assigned_to || (
                      <span className="text-white/30">Unassigned</span>
                    )}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
