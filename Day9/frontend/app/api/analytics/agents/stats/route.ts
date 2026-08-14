import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://voicepay:voicepay_dev_2026@localhost:5432/voicepay',
  max: 5,
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '7'), 1), 90);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    // Per-agent aggregated metrics
    const statsResult = await pool.query(
      `SELECT
        unnest(agents_used) as agent_name,
        COUNT(*) as activations,
        ROUND(AVG(duration_s)::numeric, 1) as avg_duration_s,
        ROUND(AVG(avg_latency_ms)::numeric, 1) as avg_latency_ms,
        SUM(tool_errors) as total_errors,
        SUM(handoff_count) as total_handoffs
      FROM call_analytics
      WHERE started_at >= $1
      GROUP BY agent_name
      ORDER BY activations DESC`,
      [cutoff.toISOString()]
    );

    // Handoff flow summary (from → to counts)
    const flowResult = await pool.query(
      `SELECT
        from_agent,
        to_agent,
        COUNT(*) as count
      FROM agent_handoffs
      WHERE timestamp >= $1
      GROUP BY from_agent, to_agent
      ORDER BY count DESC
      LIMIT 50`,
      [cutoff.toISOString()]
    );

    // Total calls and average handoffs per call
    const totalsResult = await pool.query(
      `SELECT
        COUNT(*) as total_calls,
        ROUND(AVG(handoff_count)::numeric, 1) as avg_handoffs_per_call,
        MAX(handoff_count) as max_handoffs,
        ROUND(AVG(array_length(agents_used, 1))::numeric, 1) as avg_agents_per_call
      FROM call_analytics
      WHERE started_at >= $1 AND handoff_count > 0`,
      [cutoff.toISOString()]
    );

    return NextResponse.json({
      period_days: days,
      agents: statsResult.rows,
      flow: flowResult.rows,
      totals: totalsResult.rows[0] || {
        total_calls: 0,
        avg_handoffs_per_call: 0,
        max_handoffs: 0,
        avg_agents_per_call: 0,
      },
    });
  } catch (error: any) {
    console.error('agents/stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent stats', detail: error.message },
      { status: 500 }
    );
  }
}
