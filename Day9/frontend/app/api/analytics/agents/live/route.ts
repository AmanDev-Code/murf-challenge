import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://voicepay:voicepay_dev_2026@localhost:5432/voicepay',
  max: 5,
});

export async function GET() {
  try {
    // Active calls in last 5 minutes with their current agent
    const result = await pool.query(`
      SELECT
        room_name,
        user_id,
        persona,
        channel,
        primary_agent,
        agents_used,
        handoff_count,
        started_at,
        duration_s,
        outcome
      FROM call_analytics
      WHERE started_at >= NOW() - INTERVAL '5 minutes'
        AND (outcome IS NULL OR outcome = '')
      ORDER BY started_at DESC
      LIMIT 20
    `);

    // Also get recent completed calls (last 5 min)
    const recentResult = await pool.query(`
      SELECT
        room_name,
        primary_agent,
        agents_used,
        handoff_count,
        duration_s,
        outcome,
        ended_at
      FROM call_analytics
      WHERE ended_at >= NOW() - INTERVAL '5 minutes'
        AND outcome IS NOT NULL AND outcome != ''
      ORDER BY ended_at DESC
      LIMIT 10
    `);

    return NextResponse.json({
      active_calls: result.rows,
      active_count: result.rowCount,
      recent_completed: recentResult.rows,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('agents/live error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch live data', detail: error.message },
      { status: 500 }
    );
  }
}
