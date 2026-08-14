import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const pool = getPool();
  const { id } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const { persona = 'anisha', actor = 'admin' } = body;

    // Find the escalation
    const escResult = await pool.query(
      `SELECT * FROM escalations WHERE id::text = $1 OR reference_id = $1`,
      [id]
    );

    if (escResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Escalation not found' },
        { status: 404 }
      );
    }

    const escalation = escResult.rows[0];
    const escId = escalation.id;

    // Update callback status and escalation status
    await pool.query(
      `UPDATE escalations
          SET callback_status = 'dispatched', status = 'awaiting_callback'
        WHERE id = $1`,
      [escId]
    );

    // Write audit entry
    await pool.query(
      `INSERT INTO escalation_audit_log
           (escalation_id, action, actor, notes)
       VALUES ($1, 'callback_triggered', $2, $3)`,
      [escId, actor, `Resolution callback dispatched. Persona: ${persona}`]
    );

    return NextResponse.json({
      status: 'dispatched',
      reference_id: escalation.reference_id,
    });
  } catch (error) {
    console.error(`POST /api/escalations/${id}/callback error:`, error);
    return NextResponse.json(
      { error: 'Failed to trigger callback' },
      { status: 500 }
    );
  }
}
