'use client';

import { useEffect, useState, useCallback, Fragment } from 'react';
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Call {
  id: string;
  created_at: string;
  duration_seconds: number;
  channel: string; // browser | sip
  language: string; // en | hindi | hinglish
  outcome: string; // success | failed | abandoned | error
  outcome_reason?: string | null;
  tools?: string[];
  avg_latency_ms?: number;
}

interface Filters {
  outcome: string;
  language: string;
  channel: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const CARD_BASE =
  'bg-white/[0.03] backdrop-blur-sm border border-white/[0.08] rounded-xl';

const outcomeBadge: Record<string, string> = {
  success: 'bg-green-500/15 text-green-300 border-green-500/30',
  failed: 'bg-red-500/15 text-red-300 border-red-500/30',
  abandoned: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
  error: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
};

const channelBadge: Record<string, string> = {
  browser: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  sip: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
};

const PAGE_SIZE = 20;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function relativeTime(dateStr: string): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (!Number.isFinite(diff)) return '—';
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0s';
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}

function labelize(v: string): string {
  if (!v) return '—';
  return v
    .split('_')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

// ─── Component ───────────────────────────────────────────────────────────────
export function CallHistory() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    outcome: 'all',
    language: 'all',
    channel: 'all',
  });

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.outcome !== 'all') params.set('outcome', filters.outcome);
      if (filters.language !== 'all') params.set('language', filters.language);
      if (filters.channel !== 'all') params.set('channel', filters.channel);
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(page * PAGE_SIZE));

      const res = await fetch(`/api/analytics/calls?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCalls(data.calls || data.items || []);
        setTotal(data.total ?? (data.calls?.length ?? 0));
      }
    } catch (err) {
      console.error('Failed to fetch call history:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, page]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    setPage(0);
  }, [filters.outcome, filters.language, filters.channel]);

  const start = calls.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const end = Math.min((page + 1) * PAGE_SIZE, page * PAGE_SIZE + calls.length);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white/90">Call History</h2>
          <p className="mt-1 text-sm text-white/50">
            All completed and in-flight conversations
          </p>
        </div>
        <button
          onClick={() => {
            setRefreshing(true);
            fetchData();
          }}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filter bar */}
      <div className={`${CARD_BASE} flex flex-wrap items-end gap-3 p-4`}>
        <FilterSelect
          label="Outcome"
          value={filters.outcome}
          onChange={(v) => setFilters((f) => ({ ...f, outcome: v }))}
          options={['all', 'success', 'failed', 'abandoned', 'error']}
        />
        <FilterSelect
          label="Language"
          value={filters.language}
          onChange={(v) => setFilters((f) => ({ ...f, language: v }))}
          options={['all', 'en', 'hindi', 'hinglish']}
        />
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium tracking-wider text-white/40 uppercase">
            Channel
          </span>
          <div className="flex items-center rounded-lg border border-white/[0.08] bg-white/5 p-0.5">
            {(['all', 'browser', 'sip'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setFilters((f) => ({ ...f, channel: c }))}
                className={`rounded-md px-3 py-1 text-xs transition ${
                  filters.channel === c
                    ? 'bg-[#f5a623]/10 text-[#f5a623]'
                    : 'text-white/60 hover:text-white/90'
                }`}
              >
                {labelize(c)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      {loading && calls.length === 0 ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[#f5a623]" />
        </div>
      ) : calls.length === 0 ? (
        <div className={`${CARD_BASE} flex h-64 flex-col items-center justify-center`}>
          <p className="text-white/40">No calls match these filters</p>
          <p className="mt-1 text-xs text-white/25">
            Try clearing filters or check back after new calls come in
          </p>
        </div>
      ) : (
        <div className={`${CARD_BASE} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-[10px] font-medium tracking-wider text-white/40 uppercase">
                  <th className="w-8 px-2 py-3" />
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Language</th>
                  <th className="px-4 py-3">Outcome</th>
                  <th className="px-4 py-3">Tools</th>
                  <th className="px-4 py-3">Latency</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {calls.map((call, i) => {
                    const isOpen = expanded === call.id;
                    return (
                      <Fragment key={call.id}>
                        <motion.tr
                          layout
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{
                            delay: Math.min(i * 0.015, 0.2),
                            duration: 0.2,
                          }}
                          onClick={() =>
                            setExpanded((prev) => (prev === call.id ? null : call.id))
                          }
                          className="cursor-pointer border-b border-white/[0.04] transition hover:bg-white/[0.03]"
                        >
                          <td className="px-2 py-3 text-white/40">
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </td>
                          <td className="px-4 py-3 text-white/70">
                            {relativeTime(call.created_at)}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-white/80">
                            {formatDuration(call.duration_seconds)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${
                                channelBadge[call.channel] ||
                                'border-white/10 text-white/60'
                              }`}
                            >
                              {call.channel || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-white/70">
                            {call.language || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${
                                outcomeBadge[call.outcome] ||
                                'border-white/10 text-white/60'
                              }`}
                            >
                              {call.outcome}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {(call.tools || []).slice(0, 3).map((t) => (
                                <span
                                  key={t}
                                  className="rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-white/70"
                                >
                                  {t}
                                </span>
                              ))}
                              {(call.tools?.length ?? 0) > 3 && (
                                <span className="rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-white/40">
                                  +{(call.tools?.length ?? 0) - 3}
                                </span>
                              )}
                              {!call.tools?.length && (
                                <span className="text-[11px] text-white/30">—</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 tabular-nums text-white/70">
                            {call.avg_latency_ms
                              ? `${Math.round(call.avg_latency_ms)}ms`
                              : '—'}
                          </td>
                        </motion.tr>
                        <AnimatePresence>
                          {isOpen && (
                            <motion.tr
                              key={`${call.id}-detail`}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                            >
                              <td colSpan={8} className="bg-white/[0.02] px-6 py-4">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                  <div>
                                    <p className="mb-1 text-[10px] font-medium tracking-wider text-white/40 uppercase">
                                      Outcome reason
                                    </p>
                                    <p className="text-sm text-white/75">
                                      {call.outcome_reason || 'No reason recorded'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="mb-1 text-[10px] font-medium tracking-wider text-white/40 uppercase">
                                      All tools used
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {(call.tools || []).length === 0 ? (
                                        <span className="text-sm text-white/40">
                                          No tools invoked
                                        </span>
                                      ) : (
                                        call.tools?.map((t) => (
                                          <span
                                            key={t}
                                            className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-xs text-white/80"
                                          >
                                            {t}
                                          </span>
                                        ))
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </motion.tr>
                          )}
                        </AnimatePresence>
                      </Fragment>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-white/60">
          <span>
            Showing {start}-{end} of {total.toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-white/40 tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => (p + 1 < totalPages ? p + 1 : p))}
              disabled={page + 1 >= totalPages}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium tracking-wider text-white/40 uppercase">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-[140px] rounded-lg border border-white/[0.08] bg-white/5 px-3 py-2 text-sm text-white/80 outline-none transition focus:border-[#f5a623]/50 focus:ring-1 focus:ring-[#f5a623]/20"
      >
        {options.map((opt) => (
          <option key={opt} value={opt} className="bg-[#0a0e1a] text-white/90">
            {opt === 'all' ? 'All' : labelize(opt)}
          </option>
        ))}
      </select>
    </label>
  );
}
