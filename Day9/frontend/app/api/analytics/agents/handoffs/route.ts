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
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50'), 1), 200);
    const roomName = url.searchParams.get('room_name') || '';

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    let query = `
      SELECT
        id, room_name, user_id, from_agent, to_agent,
        reason, context_summary, handoff_index, timestamp
      FROM agent_handoffs
      WHERE timestamp >= $1
    `;
    const params: any[] = [cutoff.toISOString()];

    if (roomName) {
      params.push(roomName);
      query += ` AND room_name = $${params.length}`;
    }

    query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);

    return NextResponse.json({
      period_days: days,
      total: result.rowCount,
      handoffs: result.rows,
    });
  } catch (error: any) {
    console.error('agents/handoffs error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch handoffs', detail: error.message },
      { status: 500 }
    );
  }
}
