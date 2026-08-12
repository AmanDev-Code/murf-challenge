'use client';

import { AlertCircle, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/shadcn/utils';

export type DashboardStats = {
  open: number;
  in_progress: number;
  resolved: number;
  critical_open: number;
  total: number;
  avg_resolution_hours: number;
};

const CARD_BASE =
  'bg-white/5 backdrop-blur-sm border border-white/[0.08] rounded-xl p-4';

type StatItem = {
  key: string;
  label: string;
  value: number;
  icon: typeof AlertCircle;
  color: string;
  pulse?: boolean;
};

function formatHours(h: number): string {
  if (!Number.isFinite(h) || h <= 0) return '—';
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

export function StatsCards({ stats }: { stats: DashboardStats }) {
  const items: StatItem[] = [
    { key: 'open', label: 'Open', value: stats.open, icon: AlertCircle, color: '#eab308' },
    {
      key: 'in_progress',
      label: 'In Progress',
      value: stats.in_progress,
      icon: Clock,
      color: '#3b82f6',
    },
    {
      key: 'resolved',
      label: 'Resolved',
      value: stats.resolved,
      icon: CheckCircle2,
      color: '#22c55e',
    },
    {
      key: 'critical',
      label: 'Critical',
      value: stats.critical_open,
      icon: AlertTriangle,
      color: '#ef4444',
      pulse: stats.critical_open > 0,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {items.map((it, i) => {
          const Icon = it.icon;
          const empty = it.value === 0;
          return (
            <motion.div
              key={it.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{
                opacity: 1,
                y: 0,
                boxShadow: it.pulse
                  ? [
                      '0 0 0px rgba(239,68,68,0)',
                      '0 0 24px rgba(239,68,68,0.55)',
                      '0 0 0px rgba(239,68,68,0)',
                    ]
                  : '0 0 0px rgba(0,0,0,0)',
              }}
              transition={{
                opacity: { delay: i * 0.05, duration: 0.3 },
                y: { delay: i * 0.05, duration: 0.3 },
                boxShadow: it.pulse
                  ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
                  : { duration: 0.2 },
              }}
              className={cn(
                CARD_BASE,
                'relative overflow-hidden',
                it.pulse && 'ring-1 ring-[#ef4444]/40'
              )}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-medium tracking-wider text-white/40 uppercase">
                  {it.label}
                </span>
                <Icon className="size-4" style={{ color: it.color }} />
              </div>
              <div
                className="text-2xl font-semibold tabular-nums"
                style={{ color: empty ? 'rgba(255,255,255,0.35)' : it.color }}
              >
                {it.value}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div
        className={cn(
          CARD_BASE,
          'flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center'
        )}
      >
        <div className="flex items-center gap-2 text-sm">
          <span className="text-white/40">Total tickets</span>
          <span className="font-semibold text-white/90 tabular-nums">
            {stats.total}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-white/40">Avg resolution</span>
          <span className="font-semibold text-white/90 tabular-nums">
            {formatHours(stats.avg_resolution_hours)}
          </span>
        </div>
      </div>
    </div>
  );
}
