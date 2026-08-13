import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

/**
 * GET /api/analytics/calls?days=7&outcome=&language=&channel=&limit=25&offset=0
 *
 * Paginated call history, sorted by started_at DESC.
 */
export async function GET(req: Request) {
  const pool = getPool();

  try {
    const { searchParams } = new URL(req.url);
    const days = Math.min(Math.max(parseInt(searchParams.get('days') || '7', 10), 1), 365);
    const outcome = searchParams.get('outcome');
    const language = searchParams.get('language');
    const channel = searchParams.get('channel');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '25', 10), 1), 200);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

    const conditions: string[] = [`started_at >= NOW() - ($1 || ' days')::interval`];
    const params: unknown[] = [days.toString()];
    let idx = 2;

    if (outcome) {
      conditions.push(`outcome = $${idx}`);
      params.push(outcome);
      idx++;
    }
    if (language) {
      conditions.push(`language = $${idx}`);
      params.push(language);
      idx++;
    }
    if (channel) {
      conditions.push(`channel = $${idx}`);
      params.push(channel);
      idx++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const dataQuery = `
      SELECT session_id, room_name, persona, channel, started_at, duration_s,
             user_turns, agent_turns, tools_used, language, outcome,
             outcome_reason, avg_latency_ms
        FROM call_analytics
        ${where}
        ORDER BY started_at DESC
        LIMIT $${idx} OFFSET $${idx + 1}
    `;

    const countQuery = `SELECT COUNT(*)::int AS total FROM call_analytics ${where}`;

    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, [...params, limit, offset]),
      pool.query(countQuery, params),
    ]);

    return NextResponse.json({
      calls: dataResult.rows.map(serializeRow),
      total: parseInt(countResult.rows[0]?.total || '0', 10),
      limit,
      offset,
    });
  } catch (error) {
    console.error('GET /api/analytics/calls error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch call history' },
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
