'use client';

import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { AgentFlowGraph } from './agent-flow-graph';

// Agent color mapping
const AGENT_COLORS: Record<string, string> = {
  triage: '#f5a623',
  calculator: '#4fc3f7',
  schemes: '#81c784',
  accounts: '#ba68c8',
  security: '#ef5350',
  escalation: '#ff7043',
};

interface AgentStat {
  agent_name: string;
  activations: number;
  avg_duration_s: number;
  avg_latency_ms: number;
  total_errors: number;
  total_handoffs: number;
}

interface FlowLink {
  source: string;
  target: string;
  value: number;
  avg_time_s: number;
}

interface AgentData {
  period_days: number;
  agents: AgentStat[];
  flow: { from_agent: string; to_agent: string; count: string }[];
  totals: {
    total_calls: number;
    avg_handoffs_per_call: number;
    max_handoffs: number;
    avg_agents_per_call: number;
  };
}

interface Handoff {
  id: number;
  room_name: string;
  from_agent: string;
  to_agent: string;
  reason: string;
  context_summary: string;
  handoff_index: number;
  timestamp: string;
}

export function AgentsTab() {
  const [data, setData] = useState<AgentData | null>(null);
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [flowData, setFlowData] = useState<{ nodes: any[]; links: FlowLink[] } | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [statsRes, handoffsRes, flowRes] = await Promise.all([
          fetch(`/api/analytics/agents/stats?days=${days}`),
          fetch(`/api/analytics/agents/handoffs?days=${days}&limit=30`),
          fetch(`/api/analytics/agents/flow?days=${days}`),
        ]);
        if (statsRes.ok) setData(await statsRes.json());
        if (handoffsRes.ok) {
          const h = await handoffsRes.json();
          setHandoffs(h.handoffs || []);
        }
        if (flowRes.ok) setFlowData(await flowRes.json());
      } catch (err) {
        console.error('Failed to fetch agent data:', err);
      }
      setLoading(false);
    };
    fetchAll();
    const interval = setInterval(fetchAll, 15000);
    return () => clearInterval(interval);
  }, [days]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-white/50">Loading agent analytics...</div>
      </div>
    );
  }

  const totals = data?.totals || {
    total_calls: 0,
    avg_handoffs_per_call: 0,
    max_handoffs: 0,
    avg_agents_per_call: 0,
  };

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-white/60">Period:</span>
        {[1, 7, 14, 30].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1 rounded-md text-sm transition-all ${
              days === d
                ? 'bg-[#f5a623] text-black font-medium'
                : 'bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            {d === 1 ? 'Today' : `${d}d`}
          </button>
        ))}
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Multi-Agent Calls"
          value={totals.total_calls}
          subtitle="with handoffs"
        />
        <StatCard
          label="Avg Handoffs/Call"
          value={totals.avg_handoffs_per_call}
          subtitle="per session"
        />
        <StatCard
          label="Max Handoffs"
          value={totals.max_handoffs}
          subtitle="single call"
        />
        <StatCard
          label="Avg Agents/Call"
          value={totals.avg_agents_per_call}
          subtitle="specialists used"
        />
      </div>

      {/* Agent Utilization Bar Chart */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-5">
        <h3 className="text-white font-medium mb-4">Agent Utilization</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.agents || []} margin={{ left: 0, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="agent_name"
                tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                tickFormatter={(v) => v.charAt(0).toUpperCase() + v.slice(1)}
              />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.1)' }}
                labelStyle={{ color: '#fff' }}
                itemStyle={{ color: '#f5a623' }}
              />
              <Bar dataKey="activations" name="Activations" radius={[4, 4, 0, 0]}>
                {(data?.agents || []).map((entry, i) => (
                  <Cell
                    key={i}
                    fill={AGENT_COLORS[entry.agent_name] || '#888'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Agent Flow + Handoff Heatmap */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Agent Distribution Pie */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-5">
          <h3 className="text-white font-medium mb-4">Agent Distribution</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.agents || []}
                  dataKey="activations"
                  nameKey="agent_name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ agent_name, percent }) =>
                    `${agent_name} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {(data?.agents || []).map((entry, i) => (
                    <Cell key={i} fill={AGENT_COLORS[entry.agent_name] || '#888'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Handoff Flow Table */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-5">
          <h3 className="text-white font-medium mb-4">Top Handoff Routes</h3>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {(flowData?.links || []).slice(0, 8).map((link, i) => (
              <div
                key={i}
                className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-medium"
                    style={{ background: AGENT_COLORS[link.source] || '#888', color: '#000' }}
                  >
                    {link.source}
                  </span>
                  <span className="text-white/40">→</span>
                  <span
                    className="px-2 py-0.5 rounded text-xs font-medium"
                    style={{ background: AGENT_COLORS[link.target] || '#888', color: '#000' }}
                  >
                    {link.target}
                  </span>
                </div>
                <span className="text-white/60 text-sm font-mono">{link.value}×</span>
              </div>
            ))}
            {(!flowData?.links || flowData.links.length === 0) && (
              <div className="text-white/40 text-sm text-center py-4">
                No handoff data yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Agent Flow Graph (Interactive @xyflow/react) */}
      <AgentFlowGraph links={flowData?.links || []} />

      {/* Recent Handoffs Log */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-5">
        <h3 className="text-white font-medium mb-4">Recent Handoffs</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/50 border-b border-white/10">
                <th className="text-left py-2 px-2">Time</th>
                <th className="text-left py-2 px-2">From</th>
                <th className="text-left py-2 px-2">To</th>
                <th className="text-left py-2 px-2">Reason</th>
                <th className="text-left py-2 px-2">Room</th>
              </tr>
            </thead>
            <tbody>
              {handoffs.slice(0, 15).map((h) => (
                <tr key={h.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-2 px-2 text-white/60 font-mono text-xs">
                    {new Date(h.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-2 px-2">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{ background: AGENT_COLORS[h.from_agent] || '#888', color: '#000' }}
                    >
                      {h.from_agent}
                    </span>
                  </td>
                  <td className="py-2 px-2">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{ background: AGENT_COLORS[h.to_agent] || '#888', color: '#000' }}
                    >
                      {h.to_agent}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-white/70 max-w-[200px] truncate">
                    {h.reason}
                  </td>
                  <td className="py-2 px-2 text-white/40 font-mono text-xs max-w-[120px] truncate">
                    {h.room_name}
                  </td>
                </tr>
              ))}
              {handoffs.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-white/40">
                    No handoff events recorded yet. Make a call to see agent routing in action.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: number | string;
  subtitle: string;
}) {
  return (
    <div className="bg-white/5 rounded-xl border border-white/10 p-4">
      <div className="text-white/50 text-xs uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold text-white mt-1">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="text-white/40 text-xs mt-1">{subtitle}</div>
    </div>
  );
}
