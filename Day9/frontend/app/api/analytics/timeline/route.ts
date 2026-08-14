import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

/**
 * GET /api/analytics/timeline?days=7&granularity=hour|day
 *
 * Returns call counts bucketed by time with outcome breakdown.
 */
export async function GET(req: Request) {
  const pool = getPool();

  try {
    const { searchParams } = new URL(req.url);
    const days = Math.min(Math.max(parseInt(searchParams.get('days') || '7', 10), 1), 365);
    const granularityRaw = (searchParams.get('granularity') || 'hour').toLowerCase();
    const granularity: 'hour' | 'day' = granularityRaw === 'day' ? 'day' : 'hour';

    // Whitelist the granularity value — never interpolate raw user input.
    const bucketExpr = granularity === 'day' ? "date_trunc('day', started_at)" : "date_trunc('hour', started_at)";

    const result = await pool.query(
      `
      SELECT
        ${bucketExpr} AS bucket,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE outcome = 'success')::int AS success,
        COUNT(*) FILTER (WHERE outcome = 'failed')::int AS failed,
        COUNT(*) FILTER (WHERE outcome = 'abandoned')::int AS abandoned,
        COUNT(*) FILTER (WHERE outcome = 'error')::int AS error
      FROM call_analytics
      WHERE started_at >= NOW() - ($1 || ' days')::interval
      GROUP BY bucket
      ORDER BY bucket ASC
      `,
      [days.toString()]
    );

    const data = result.rows.map((row) => ({
      bucket: row.bucket instanceof Date ? row.bucket.toISOString() : String(row.bucket),
      total: parseInt(row.total || '0', 10),
      success: parseInt(row.success || '0', 10),
      failed: parseInt(row.failed || '0', 10),
      abandoned: parseInt(row.abandoned || '0', 10),
      error: parseInt(row.error || '0', 10),
    }));

    return NextResponse.json({ granularity, data });
  } catch (error) {
    console.error('GET /api/analytics/timeline error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timeline analytics' },
      { status: 500 }
    );
  }
}
