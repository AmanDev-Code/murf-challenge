import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export async function GET() {
  const pool = getPool();

  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'open') as open_count,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_count,
        COUNT(*) FILTER (WHERE status IN ('resolved', 'closed')) as resolved_count,
        COUNT(*) FILTER (WHERE urgency = 'critical' AND status IN ('open', 'in_progress')) as critical_open,
        COUNT(*) as total_count,
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)
          FILTER (WHERE resolved_at IS NOT NULL) as avg_resolution_hours
      FROM escalations
    `);

    const row = result.rows[0];

    return NextResponse.json({
      open: parseInt(row.open_count || '0', 10),
      in_progress: parseInt(row.in_progress_count || '0', 10),
      resolved: parseInt(row.resolved_count || '0', 10),
      critical_open: parseInt(row.critical_open || '0', 10),
      total: parseInt(row.total_count || '0', 10),
      avg_resolution_hours: row.avg_resolution_hours
        ? Math.round(parseFloat(row.avg_resolution_hours) * 10) / 10
        : 0,
    });
  } catch (error) {
    console.error('GET /api/escalations/stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch escalation stats' },
      { status: 500 }
    );
  }
}
