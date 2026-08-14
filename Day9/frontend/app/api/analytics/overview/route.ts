import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

/**
 * GET /api/analytics/overview?days=7
 *
 * Returns aggregated stats over the requested window:
 *   - total_calls, per-outcome counts, success_rate (%)
 *   - avg_duration_s, avg_latency_ms
 *   - calls_today, calls_this_week
 */
export async function GET(req: Request) {
  const pool = getPool();

  try {
    const { searchParams } = new URL(req.url);
    const days = Math.min(Math.max(parseInt(searchParams.get('days') || '7', 10), 1), 365);

    const result = await pool.query(
      `
      SELECT
        COUNT(*)::int AS total_calls,
        COUNT(*) FILTER (WHERE outcome = 'success')::int AS success_count,
        COUNT(*) FILTER (WHERE outcome = 'failed')::int AS failed_count,
        COUNT(*) FILTER (WHERE outcome = 'abandoned')::int AS abandoned_count,
        COUNT(*) FILTER (WHERE outcome = 'error')::int AS error_count,
        COALESCE(AVG(duration_s) FILTER (WHERE duration_s > 0), 0)::float AS avg_duration_s,
        COALESCE(AVG(avg_latency_ms) FILTER (WHERE avg_latency_ms > 0), 0)::float AS avg_latency_ms,
        COUNT(*) FILTER (WHERE started_at >= date_trunc('day', NOW()))::int AS calls_today,
        COUNT(*) FILTER (WHERE started_at >= NOW() - INTERVAL '7 days')::int AS calls_this_week
      FROM call_analytics
      WHERE started_at >= NOW() - ($1 || ' days')::interval
      `,
      [days.toString()]
    );

    const row = result.rows[0] || {};
    const total = parseInt(row.total_calls || '0', 10);
    const success = parseInt(row.success_count || '0', 10);
    const successRate = total > 0 ? Math.round((success / total) * 1000) / 10 : 0;

    return NextResponse.json({
      total_calls: total,
      success_count: success,
      failed_count: parseInt(row.failed_count || '0', 10),
      abandoned_count: parseInt(row.abandoned_count || '0', 10),
      error_count: parseInt(row.error_count || '0', 10),
      success_rate: successRate,
      avg_duration_s: Math.round(parseFloat(row.avg_duration_s || '0') * 10) / 10,
      avg_latency_ms: Math.round(parseFloat(row.avg_latency_ms || '0')),
      calls_today: parseInt(row.calls_today || '0', 10),
      calls_this_week: parseInt(row.calls_this_week || '0', 10),
    });
  } catch (error) {
    console.error('GET /api/analytics/overview error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch overview analytics' },
      { status: 500 }
    );
  }
}
