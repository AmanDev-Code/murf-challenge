import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

/**
 * GET /api/analytics/live
 *
 * Returns calls started in the last 5 minutes plus live stats:
 *   - active_calls: calls with no ended_at
 *   - current_avg_latency: mean avg_latency_ms across the window
 *   - recent_successes: successful calls in the window
 */
export async function GET(_req: Request) {
  const pool = getPool();

  try {
    const [callsResult, statsResult] = await Promise.all([
      pool.query(
        `
        SELECT session_id, room_name, persona, channel, started_at, duration_s,
               user_turns, agent_turns, tools_used, language, outcome,
               outcome_reason, avg_latency_ms
          FROM call_analytics
         WHERE started_at >= NOW() - INTERVAL '5 minutes'
         ORDER BY started_at DESC
        `
      ),
      pool.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE ended_at IS NULL)::int AS active_calls,
          COALESCE(AVG(avg_latency_ms) FILTER (WHERE avg_latency_ms > 0), 0)::float AS current_avg_latency,
          COUNT(*) FILTER (WHERE outcome = 'success')::int AS recent_successes
        FROM call_analytics
        WHERE started_at >= NOW() - INTERVAL '5 minutes'
        `
      ),
    ]);

    const statsRow = statsResult.rows[0] || {};

    return NextResponse.json({
      calls: callsResult.rows.map(serializeRow),
      stats: {
        active_calls: parseInt(statsRow.active_calls || '0', 10),
        current_avg_latency: Math.round(parseFloat(statsRow.current_avg_latency || '0')),
        recent_successes: parseInt(statsRow.recent_successes || '0', 10),
      },
    });
  } catch (error) {
    console.error('GET /api/analytics/live error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch live analytics' },
      { status: 500 }
    );
  }
}

function serializeRow(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) {
      result[key] = value.toISOString();
    } else {
      result[key] = value;
    }
  }
  return result;
}
