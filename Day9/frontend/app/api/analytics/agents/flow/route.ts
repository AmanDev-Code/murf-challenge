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

    // Agent-to-agent flow (from/to pairs with counts) for sankey visualization
    const result = await pool.query(
      `SELECT
        from_agent,
        to_agent,
        COUNT(*) as count,
        ROUND(AVG(EXTRACT(EPOCH FROM (
          LEAD(timestamp) OVER (PARTITION BY room_name ORDER BY timestamp) - timestamp
        )))::numeric, 1) as avg_time_in_agent_s
      FROM agent_handoffs
      WHERE timestamp >= $1
      GROUP BY from_agent, to_agent
      ORDER BY count DESC`,
      [cutoff.toISOString()]
    );

    // Build nodes list (unique agents)
    const agentSet = new Set<string>();
    for (const row of result.rows) {
      agentSet.add(row.from_agent);
      agentSet.add(row.to_agent);
    }

    const nodes = Array.from(agentSet).map((name) => ({
      id: name,
      label: name.charAt(0).toUpperCase() + name.slice(1),
    }));

    return NextResponse.json({
      period_days: days,
      nodes,
      links: result.rows.map((r: any) => ({
        source: r.from_agent,
        target: r.to_agent,
        value: parseInt(r.count),
        avg_time_s: parseFloat(r.avg_time_in_agent_s) || 0,
      })),
    });
  } catch (error: any) {
    console.error('agents/flow error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent flow', detail: error.message },
      { status: 500 }
    );
  }
}
