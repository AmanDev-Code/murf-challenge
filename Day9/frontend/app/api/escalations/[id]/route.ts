import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const pool = getPool();
  const { id } = await params;

  try {
    // Look up by UUID or reference_id (VP-2026-XXXXX format)
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

    // Fetch messages and audit log in parallel
    const [messagesResult, auditResult] = await Promise.all([
      pool.query(
        `SELECT role, content, tool_name, tool_args, original_timestamp, created_at
           FROM escalation_messages
          WHERE escalation_id = $1
          ORDER BY original_timestamp`,
        [escalation.id]
      ),
      pool.query(
        `SELECT action, actor, old_value, new_value, notes, created_at
           FROM escalation_audit_log
          WHERE escalation_id = $1
          ORDER BY created_at`,
        [escalation.id]
      ),
    ]);

    return NextResponse.json({
      escalation: serializeRow(escalation),
      messages: messagesResult.rows.map(serializeRow),
      audit_log: auditResult.rows.map(serializeRow),
    });
  } catch (error) {
    console.error(`GET /api/escalations/${id} error:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch escalation' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const pool = getPool();
  const { id } = await params;

  try {
    const body = await req.json();
    const { status, assigned_to, resolution_notes, actor = 'admin' } = body;

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

    const updates: string[] = [];
    const updateParams: unknown[] = [];
    let idx = 1;

    // Status change
    if (status) {
      updates.push(`status = $${idx}`);
      updateParams.push(status);
      idx++;

      if (status === 'resolved' || status === 'closed') {
        updates.push('resolved_at = NOW()');
      }

      // Write audit entry for status change
      await pool.query(
        `INSERT INTO escalation_audit_log
             (escalation_id, action, actor, old_value, new_value)
         VALUES ($1, 'status_change', $2, $3, $4)`,
        [escId, actor, escalation.status, status]
      );
    }

    // Assignment change
    if (assigned_to) {
      updates.push(`assigned_to = $${idx}`);
      updateParams.push(assigned_to);
      idx++;

      await pool.query(
        `INSERT INTO escalation_audit_log
             (escalation_id, action, actor, old_value, new_value)
         VALUES ($1, 'assigned', $2, $3, $4)`,
        [escId, actor, escalation.assigned_to, assigned_to]
      );
    }

    // Resolution notes
    if (resolution_notes) {
      updates.push(`resolution_notes = $${idx}`);
      updateParams.push(resolution_notes);
      idx++;
    }

    if (updates.length > 0) {
      updateParams.push(escId);
      await pool.query(
        `UPDATE escalations SET ${updates.join(', ')} WHERE id = $${idx}`,
        updateParams
      );
    }

    return NextResponse.json({
      status: 'updated',
      escalation_id: escId,
    });
  } catch (error) {
    console.error(`PATCH /api/escalations/${id} error:`, error);
    return NextResponse.json(
      { error: 'Failed to update escalation' },
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
