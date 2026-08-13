import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

/**
 * GET /api/analytics/tools?days=7
 *
 * Returns tool usage frequency: for each tool that appeared in tools_used,
 *   - call_count: number of calls that used the tool
 *   - success_with_tool: number of those calls whose outcome = 'success'
 */
export async function GET(req: Request) {
  const pool = getPool();

  try {
    const { searchParams } = new URL(req.url);
    const days = Math.min(Math.max(parseInt(searchParams.get('days') || '7', 10), 1), 365);

    const result = await pool.query(
      `
      SELECT
        tool_name,
        COUNT(*)::int AS call_count,
        COUNT(*) FILTER (WHERE outcome = 'success')::int AS success_with_tool
      FROM (
        SELECT DISTINCT unnest(tools_used) AS tool_name, session_id, outcome
        FROM call_analytics
        WHERE started_at >= NOW() - ($1 || ' days')::interval
          AND tools_used IS NOT NULL
          AND array_length(tools_used, 1) > 0
      ) t
      GROUP BY tool_name
      ORDER BY call_count DESC
      `,
      [days.toString()]
    );

    const tools = result.rows.map((row) => ({
      tool_name: String(row.tool_name),
      call_count: parseInt(row.call_count || '0', 10),
      success_with_tool: parseInt(row.success_with_tool || '0', 10),
    }));

    return NextResponse.json({ tools });
  } catch (error) {
    console.error('GET /api/analytics/tools error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tools analytics' },
      { status: 500 }
    );
  }
}
