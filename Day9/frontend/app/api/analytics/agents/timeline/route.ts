import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://voicepay:voicepay_dev_2026@localhost:5432/voicepay',
  max: 5,
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ room: string }> }
) {
  try {
    const { room } = await params;

    if (!room) {
      return NextResponse.json({ error: 'Room name required' }, { status: 400 });
    }

    // Get handoff timeline for a specific call
    const handoffsResult = await pool.query(
      `SELECT
        from_agent, to_agent, reason, context_summary,
        handoff_index, timestamp
      FROM agent_handoffs
      WHERE room_name = $1
      ORDER BY handoff_index ASC`,
      [room]
    );

    // Get the call metadata
    const callResult = await pool.query(
      `SELECT
        room_name, persona, channel, started_at, ended_at,
        duration_s, agents_used, handoff_count, outcome,
        primary_agent, handoff_timeline
      FROM call_analytics
      WHERE room_name = $1`,
      [room]
    );

    const call = callResult.rows[0] || null;

    return NextResponse.json({
      room_name: room,
      call,
      handoffs: handoffsResult.rows,
      total_handoffs: handoffsResult.rowCount,
    });
  } catch (error: any) {
    console.error('agents/timeline error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timeline', detail: error.message },
      { status: 500 }
    );
  }
}
