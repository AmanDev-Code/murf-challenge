'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Shield,
  RefreshCw,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Escalation {
  id: string;
  reference_id: string;
  user_id: string | null;
  type: string;
  urgency: string;
  status: string;
  assigned_to: string | null;
  caller_name: string | null;
  summary: string;
  language: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  callback_status: string | null;
}

interface Stats {
  open: number;
  in_progress: number;
  resolved: number;
  critical_open: number;
  total: number;
  avg_resolution_hours: number;
}

interface Filters {
  status: string;
  urgency: string;
  type: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const urgencyColor: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

const urgencyText: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
  low: 'text-green-400',
};

const statusPill: Record<string, string> = {
  open: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  in_progress: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  awaiting_callback: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  resolved: 'bg-green-500/20 text-green-300 border-green-500/30',
  closed: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
};

const typeBadge: Record<string, string> = {
  fraud: 'bg-red-500/20 text-red-300 border-red-500/30',
  regulatory: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
};

// ─── Component ───────────────────────────────────────────────────────────────
export function EscalationsTab() {
  const router = useRouter();
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filters, setFilters] = useState<Filters>({ status: '', urgency: '', type: '' });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.urgency) params.set('urgency', filters.urgency);
      if (filters.type) params.set('type', filters.type);

      const [escRes, statsRes] = await Promise.all([
        fetch(`/api/escalations?${params.toString()}`),
        fetch('/api/escalations/stats'),
      ]);

      if (escRes.ok) {
        const data = await escRes.json();
        setEscalations(data.escalations || []);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white/90">Escalation Tickets</h2>
          <p className="mt-1 text-sm text-white/50">
            Human-help tickets requiring attention
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<AlertCircle className="h-5 w-5 text-yellow-400" />}
            label="Open"
            count={stats.open}
            accent="border-yellow-500/30"
          />
          <StatCard
            icon={<Clock className="h-5 w-5 text-blue-400" />}
            label="In Progress"
            count={stats.in_progress}
            accent="border-blue-500/30"
          />
          <StatCard
            icon={<CheckCircle2 className="h-5 w-5 text-green-400" />}
            label="Resolved"
            count={stats.resolved}
            accent="border-green-500/30"
          />
          <StatCard
            icon={<AlertTriangle className="h-5 w-5 text-red-400" />}
            label="Critical Open"
            count={stats.critical_open}
            accent="border-red-500/30"
            pulse={stats.critical_open > 0}
          />
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <FilterSelect
          value={filters.status}
          onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
          options={['', 'open', 'in_progress', 'awaiting_callback', 'resolved', 'closed']}
          labels={[
            'All Status',
            'Open',
            'In Progress',
            'Awaiting Callback',
            'Resolved',
            'Closed',
          ]}
        />
        <FilterSelect
          value={filters.urgency}
          onChange={(v) => setFilters((f) => ({ ...f, urgency: v }))}
          options={['', 'critical', 'high', 'medium', 'low']}
          labels={['All Urgency', 'Critical', 'High', 'Medium', 'Low']}
        />
        <FilterSelect
          value={filters.type}
          onChange={(v) => setFilters((f) => ({ ...f, type: v }))}
          options={['', 'fraud', 'regulatory']}
          labels={['All Types', 'Fraud', 'Regulatory']}
        />
        {(filters.status || filters.urgency || filters.type) && (
          <button
            onClick={() => setFilters({ status: '', urgency: '', type: '' })}
            className="text-sm text-white/50 hover:text-white/80"
          >
            Clear filters
          </button>
        )}

        {stats && (
          <div className="ml-auto text-xs text-white/40">
            {stats.total} total · Avg resolution: {stats.avg_resolution_hours}h
          </div>
        )}
      </div>

      {/* Ticket List */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[#f5a623]" />
        </div>
      ) : escalations.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm">
          <Shield className="mb-3 h-12 w-12 text-white/20" />
          <p className="text-white/40">No escalation tickets</p>
          <p className="mt-1 text-xs text-white/25">
            Tickets appear here when the voice agent escalates to a human
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-xs uppercase text-white/40">
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Urgency</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Caller</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Assigned</th>
              </tr>
            </thead>
            <tbody>
              {escalations.map((esc) => (
                <tr
                  key={esc.id}
                  onClick={() => router.push(`/dashboard/${esc.reference_id}`)}
                  className="cursor-pointer border-b border-white/[0.04] transition hover:border-l-2 hover:border-l-[#f5a623] hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-3 font-mono text-sm text-white/80">
                    {esc.reference_id}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        typeBadge[esc.type] || ''
                      }`}
                    >
                      {esc.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${urgencyColor[esc.urgency]}`}
                      />
                      <span className={`text-xs ${urgencyText[esc.urgency]}`}>
                        {esc.urgency}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        statusPill[esc.status] || ''
                      }`}
                    >
                      {esc.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-white/60">
                    {esc.caller_name || esc.user_id || '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-white/40">
                    {relativeTime(esc.created_at)}
                  </td>
                  <td className="px-4 py-3 text-sm text-white/50">
                    {esc.assigned_to || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function StatCard({
  icon,
  label,
  count,
  accent,
  pulse,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  accent: string;
  pulse?: boolean;
}) {
  return (
    <div
      className={`relative rounded-xl border bg-white/[0.03] p-5 backdrop-blur-sm ${accent} ${
        pulse ? 'animate-pulse' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        {icon}
        <span className="text-3xl font-semibold text-white/90">{count}</span>
      </div>
      <p className="mt-2 text-sm text-white/50">{label}</p>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  labels,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labels: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 outline-none transition focus:border-[#f5a623]/50 focus:ring-1 focus:ring-[#f5a623]/20"
    >
      {options.map((opt, i) => (
        <option key={opt} value={opt} className="bg-[#0a0e1a] text-white">
          {labels[i]}
        </option>
      ))}
    </select>
  );
}
