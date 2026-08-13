'use client';

import { useEffect, useState, useCallback } from 'react';
import { Mic, Brain, Volume2 } from 'lucide-react';
import { motion } from 'motion/react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────
interface LatencyData {
  percentiles: {
    p50: number;
    p75: number;
    p95: number;
    p99: number;
  };
  components: {
    eou_avg_ms: number;
    llm_ttft_avg_ms: number;
    tts_ttfb_avg_ms: number;
  };
  timeline: LatencyBucket[];
}

interface LatencyBucket {
  bucket: string;
  eou_ms: number;
  llm_ms: number;
  tts_ms: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const COLORS = {
  gold: '#f5a623',
  blue: '#3b82f6',
  green: '#22c55e',
  red: '#ef4444',
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

function formatMs(val: number | undefined | null): string {
  if (val === undefined || val === null || !Number.isFinite(val)) return '—';
  return `${Math.round(val)}`;
}

// ─── Component ───────────────────────────────────────────────────────────────
export function LatencyMetrics() {
  const [data, setData] = useState<LatencyData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/analytics/latency');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch latency metrics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[#f5a623]" />
      </div>
    );
  }

  const percentiles = data?.percentiles ?? { p50: 0, p75: 0, p95: 0, p99: 0 };
  const rawComp = data?.components || data?.component_averages || {};
  const components = {
    eou_avg_ms: rawComp.eou_avg_ms || rawComp.eou_ms || 0,
    llm_ttft_avg_ms: rawComp.llm_ttft_avg_ms || rawComp.llm_ttft_ms || 0,
    tts_ttfb_avg_ms: rawComp.tts_ttfb_avg_ms || rawComp.tts_ttfb_ms || 0,
  };
  const timeline = (data?.timeline ?? []).map((t: any) => ({
    time: formatBucket(t.bucket),
    eou_ms: t.avg_eou || t.eou_ms || 0,
    llm_ms: t.avg_llm || t.llm_ms || 0,
    tts_ms: t.avg_tts || t.tts_ms || 0,
  }));

  const percentileCards = [
    { key: 'p50', label: '50th percentile', value: percentiles.p50, color: COLORS.gold },
    { key: 'p75', label: '75th percentile', value: percentiles.p75, color: COLORS.blue },
    { key: 'p95', label: '95th percentile', value: percentiles.p95, color: COLORS.orange },
    { key: 'p99', label: '99th percentile', value: percentiles.p99, color: COLORS.red },
  ];

  const componentCards = [
    {
      key: 'eou',
      label: 'EOU Detection',
      value: components.eou_avg_ms,
      icon: Mic,
      color: COLORS.orange,
    },
    {
      key: 'llm',
      label: 'LLM TTFT',
      value: components.llm_ttft_avg_ms,
      icon: Brain,
      color: COLORS.blue,
    },
    {
      key: 'tts',
      label: 'TTS TTFB',
      value: components.tts_ttfb_avg_ms,
      icon: Volume2,
      color: COLORS.purple,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Percentile cards row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {percentileCards.map((p, i) => (
          <motion.div
            key={p.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
            className={`${CARD_BASE} p-4`}
          >
            <span className="text-[10px] font-medium tracking-wider text-white/40 uppercase">
              {p.key}
            </span>
            <div
              className="mt-2 text-3xl font-semibold tabular-nums"
              style={{ color: p.color }}
            >
              {formatMs(p.value)}
              <span className="ml-1 text-sm font-normal text-white/40">ms</span>
            </div>
            <p className="mt-1 text-[11px] text-white/40">{p.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Component breakdown cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {componentCards.map((c, i) => {
          const Icon = c.icon;
          return (
            <motion.div
              key={c.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 + 0.2, duration: 0.3 }}
              className={`${CARD_BASE} p-5`}
            >
              <div className="mb-3 flex items-center gap-2.5">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: `${c.color}1a`,
                    border: `1px solid ${c.color}33`,
                  }}
                >
                  <Icon className="h-4 w-4" style={{ color: c.color }} />
                </div>
                <span className="text-sm font-medium text-white/70">{c.label}</span>
              </div>
              <div
                className="text-2xl font-semibold tabular-nums"
                style={{ color: c.color }}
              >
                {formatMs(c.value)}
                <span className="ml-1 text-sm font-normal text-white/40">ms</span>
              </div>
              <p className="mt-1 text-[11px] text-white/30">average</p>
            </motion.div>
          );
        })}
      </div>

      {/* Latency over time */}
      <div className={`${CARD_BASE} p-5`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-white/70">Latency Over Time</h3>
          <span className="text-[10px] text-white/30">Stacked components</span>
        </div>
        {timeline.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-white/30">
            No latency timeline data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={timeline}>
              <defs>
                <linearGradient id="grad-eou" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.orange} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={COLORS.orange} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-llm" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-tts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.purple} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={COLORS.purple} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={TICK_STYLE} stroke={GRID_STROKE} />
              <YAxis
                tick={TICK_STYLE}
                stroke={GRID_STROKE}
                label={{
                  value: 'ms',
                  position: 'insideTopLeft',
                  style: { fill: 'rgba(255,255,255,0.4)', fontSize: 10 },
                }}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend
                wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}
              />
              <Area
                type="monotone"
                dataKey="eou_ms"
                name="EOU"
                stackId="1"
                stroke={COLORS.orange}
                fill="url(#grad-eou)"
              />
              <Area
                type="monotone"
                dataKey="llm_ms"
                name="LLM"
                stackId="1"
                stroke={COLORS.blue}
                fill="url(#grad-llm)"
              />
              <Area
                type="monotone"
                dataKey="tts_ms"
                name="TTS"
                stackId="1"
                stroke={COLORS.purple}
                fill="url(#grad-tts)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
