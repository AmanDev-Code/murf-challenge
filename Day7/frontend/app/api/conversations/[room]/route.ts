import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ room: string }> }
) {
  const pool = getPool();
  const { room } = await params;

  try {
    const result = await pool.query(
      `SELECT role, content, tool_name, tool_args, persona,
              sentiment, language, created_at
         FROM conversation_logs
        WHERE room_name = $1
        ORDER BY created_at`,
      [room]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: `No conversation logs for room '${room}'` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      room_name: room,
      message_count: result.rows.length,
      messages: result.rows.map(serializeRow),
    });
  } catch (error) {
    console.error(`GET /api/conversations/${room} error:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch conversation logs' },
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
