'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Phone,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Overview {
  total_calls: number;
  success_rate: number; // percentage 0-100
  failed_calls: number;
  avg_duration_seconds: number;
  avg_latency_ms: number;
  success_count?: number;
  abandoned_count?: number;
  error_count?: number;
}

interface TimelineBucket {
  bucket: string; // ISO time
  success: number;
  failed: number;
  abandoned: number;
  error: number;
}

interface ToolUsage {
  tool: string;
  count: number;
}

// ─── Theme constants ─────────────────────────────────────────────────────────
const COLORS = {
  gold: '#f5a623',
  blue: '#3b82f6',
  green: '#22c55e',
  red: '#ef4444',
  gray: '#6b7280',
  orange: '#f97316',
  purple: '#a855f7',
};

const GRID_STROKE = 'rgba(255,255,255,0.06)';
const TICK_STYLE = { fill: 'rgba(255,255,255,0.5)', fontSize: 11 };
const TOOLTIP_STYLE = {
  background: '#1a1f2e',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  color: '#e5e7eb',
};

const CARD_BASE =
  'bg-white/[0.03] backdrop-blur-sm border border-white/[0.08] rounded-xl';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatBucket(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatNumber(n: number | undefined | null): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return '0';
  return Math.round(n).toLocaleString();
}

// ─── Component ───────────────────────────────────────────────────────────────
export function AnalyticsOverview() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [timeline, setTimeline] = useState<TimelineBucket[]>([]);
  const [tools, setTools] = useState<ToolUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [pulseKey, setPulseKey] = useState(0);
  const firstLoadRef = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      const [ovRes, tlRes, toolsRes] = await Promise.all([
        fetch('/api/analytics/overview').catch(() => null),
        fetch('/api/analytics/timeline').catch(() => null),
        fetch('/api/analytics/tools').catch(() => null),
      ]);

      if (ovRes?.ok) {
        const data = await ovRes.json();
        setOverview(data);
      }
      if (tlRes?.ok) {
        const data = await tlRes.json();
        setTimeline(data.data || data.timeline || data.buckets || []);
      }
      if (toolsRes?.ok) {
        const data = await toolsRes.json();
        setTools(data.tools || data || []);
      }

      if (!firstLoadRef.current) {
        setPulseKey((k) => k + 1);
      }
      firstLoadRef.current = false;
    } catch (err) {
      console.error('Failed to fetch analytics overview:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading && !overview) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[#f5a623]" />
      </div>
    );
  }

  const ov = overview ?? {
    total_calls: 0,
    success_rate: 0,
    failed_calls: 0,
    avg_duration_seconds: 0,
    avg_latency_ms: 0,
  };

  const successCount =
    ov.success_count ?? Math.round((ov.total_calls * ov.success_rate) / 100);
  const abandonedCount = ov.abandoned_count ?? 0;
  const errorCount = ov.error_count ?? 0;

  const outcomeData = [
    { name: 'Success', value: successCount, color: COLORS.green },
    { name: 'Failed', value: ov.failed_calls, color: COLORS.red },
    { name: 'Abandoned', value: abandonedCount, color: COLORS.gray },
    { name: 'Error', value: errorCount, color: COLORS.orange },
  ].filter((d) => d.value > 0);

  const timelineFormatted = timeline.map((t) => ({
    ...t,
    time: formatBucket(t.bucket),
  }));

  const topTools = [...tools].sort((a, b) => b.count - a.count).slice(0, 8);

  const stats = [
    {
      key: 'total',
      label: 'Total Calls',
      value: formatNumber(ov.total_calls),
      icon: Phone,
      color: COLORS.gold,
    },
    {
      key: 'success',
      label: 'Success Rate',
      value: `${(ov.success_rate ?? 0).toFixed(1)}%`,
      icon: CheckCircle2,
      color: COLORS.green,
    },
    {
      key: 'failed',
      label: 'Failed Calls',
      value: formatNumber(ov.failed_calls),
      icon: XCircle,
      color: COLORS.red,
    },
    {
      key: 'duration',
      label: 'Avg Duration',
      value: `${formatNumber(ov.avg_duration_seconds)}s`,
      icon: Clock,
      color: COLORS.blue,
    },
    {
      key: 'latency',
      label: 'Avg Latency',
      value: `${formatNumber(ov.avg_latency_ms)}ms`,
      icon: Zap,
      color: COLORS.purple,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hero stat cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={`${s.key}-${pulseKey}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{
                opacity: 1,
                y: 0,
                boxShadow: pulseKey
                  ? [
                      `0 0 0px ${s.color}00`,
                      `0 0 18px ${s.color}55`,
                      `0 0 0px ${s.color}00`,
                    ]
                  : `0 0 0px ${s.color}00`,
              }}
              transition={{
                opacity: { delay: i * 0.04, duration: 0.3 },
                y: { delay: i * 0.04, duration: 0.3 },
                boxShadow: pulseKey
                  ? { duration: 1.6, ease: 'easeInOut' }
                  : { duration: 0.2 },
              }}
              className={`${CARD_BASE} relative overflow-hidden p-4`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-medium tracking-wider text-white/40 uppercase">
                  {s.label}
                </span>
                <Icon className="size-4" style={{ color: s.color }} />
              </div>
              <div
                className="text-2xl font-semibold tabular-nums"
                style={{ color: s.color }}
              >
                {s.value}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Timeline chart */}
      <div className={`${CARD_BASE} p-5`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-white/70">Calls Over Time</h3>
          <span className="text-[10px] text-white/30">Auto-refresh 15s</span>
        </div>
        {timelineFormatted.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-white/30">
            No timeline data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={timelineFormatted}>
              <defs>
                <linearGradient id="grad-success" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={COLORS.green} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-failed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.red} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={COLORS.red} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-abandoned" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.gray} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={COLORS.gray} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-error" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.orange} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={COLORS.orange} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={TICK_STYLE} stroke={GRID_STROKE} />
              <YAxis tick={TICK_STYLE} stroke={GRID_STROKE} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend
                wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}
              />
              <Area
                type="monotone"
                dataKey="success"
                stackId="1"
                stroke={COLORS.green}
                fill="url(#grad-success)"
              />
              <Area
                type="monotone"
                dataKey="failed"
                stackId="1"
                stroke={COLORS.red}
                fill="url(#grad-failed)"
              />
              <Area
                type="monotone"
                dataKey="abandoned"
                stackId="1"
                stroke={COLORS.gray}
                fill="url(#grad-abandoned)"
              />
              <Area
                type="monotone"
                dataKey="error"
                stackId="1"
                stroke={COLORS.orange}
                fill="url(#grad-error)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Two-column row: outcome donut + tool usage */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Outcome donut */}
        <div className={`${CARD_BASE} p-5`}>
          <h3 className="mb-4 text-sm font-medium text-white/70">
            Outcome Distribution
          </h3>
          {outcomeData.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-white/30">
              No outcome data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={outcomeData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={2}
                  stroke="#0a0e1a"
                  strokeWidth={2}
                >
                  {outcomeData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend
                  wrapperStyle={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.6)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Tool usage bar chart */}
        <div className={`${CARD_BASE} p-5`}>
          <h3 className="mb-4 text-sm font-medium text-white/70">Top Tool Usage</h3>
          {topTools.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-white/30">
              No tool usage data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topTools} layout="vertical">
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  tick={TICK_STYLE}
                  stroke={GRID_STROKE}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="tool"
                  tick={TICK_STYLE}
                  stroke={GRID_STROKE}
                  width={110}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar
                  dataKey="count"
                  fill={COLORS.gold}
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
