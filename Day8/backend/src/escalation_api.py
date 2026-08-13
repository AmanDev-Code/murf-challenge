"""
=============================================================================
 VoicePay — Day 7 Escalation Dashboard API
 FastAPI backend powering the admin dashboard.
 Run: uvicorn escalation_api:app --host 0.0.0.0 --port 8081 --reload
=============================================================================
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv(".env.local")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)-22s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("voicepay.escalation_api")

app = FastAPI(
    title="VoicePay Escalation API",
    version="1.0.0",
    description="Dashboard backend for managing human-help escalation tickets",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class EscalationUpdate(BaseModel):
    status: str | None = None
    assigned_to: str | None = None
    resolution_notes: str | None = None
    actor: str = "admin"


class CallbackRequest(BaseModel):
    persona: str = "anisha"
    actor: str = "admin"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/api/escalations")
async def list_escalations(
    status: str | None = Query(None, description="Filter by status"),
    urgency: str | None = Query(None, description="Filter by urgency"),
    type: str | None = Query(None, description="Filter by type (fraud/regulatory)"),
    limit: int = Query(50, le=100, ge=1),
    offset: int = Query(0, ge=0),
):
    """List escalation tickets with optional filters, sorted by urgency then recency."""
    from memory import get_pool

    pool = await get_pool()
    conditions: list[str] = []
    params: list[Any] = []
    idx = 1

    if status:
        conditions.append(f"status = ${idx}")
        params.append(status)
        idx += 1
    if urgency:
        conditions.append(f"urgency = ${idx}")
        params.append(urgency)
        idx += 1
    if type:
        conditions.append(f"type = ${idx}")
        params.append(type)
        idx += 1

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"""
            SELECT id, reference_id, user_id, type, urgency, status, assigned_to,
                   caller_name, summary, language, follow_up_method,
                   created_at, updated_at, resolved_at, callback_status
              FROM escalations {where}
             ORDER BY
                CASE urgency
                    WHEN 'critical' THEN 0
                    WHEN 'high' THEN 1
                    WHEN 'medium' THEN 2
                    ELSE 3
                END,
                created_at DESC
             LIMIT ${idx} OFFSET ${idx + 1}
            """,
            *params, limit, offset,
        )
        total = await conn.fetchval(
            f"SELECT COUNT(*) FROM escalations {where}", *params,
        )

    return {
        "escalations": [_row_to_dict(r) for r in rows],
        "total": total or 0,
        "limit": limit,
        "offset": offset,
    }


@app.get("/api/escalations/stats")
async def get_stats():
    """Dashboard aggregate statistics."""
    from memory import get_pool

    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT
                COUNT(*) FILTER (WHERE status = 'open') as open_count,
                COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_count,
                COUNT(*) FILTER (WHERE status IN ('resolved', 'closed')) as resolved_count,
                COUNT(*) FILTER (WHERE urgency = 'critical' AND status IN ('open', 'in_progress')) as critical_open,
                COUNT(*) as total_count,
                AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)
                    FILTER (WHERE resolved_at IS NOT NULL) as avg_resolution_hours
            FROM escalations
        """)

    return {
        "open": row["open_count"] or 0,
        "in_progress": row["in_progress_count"] or 0,
        "resolved": row["resolved_count"] or 0,
        "critical_open": row["critical_open"] or 0,
        "total": row["total_count"] or 0,
        "avg_resolution_hours": round(float(row["avg_resolution_hours"] or 0), 1),
    }


@app.get("/api/escalations/{escalation_id}")
async def get_escalation(escalation_id: str):
    """Get full escalation detail with conversation messages and audit trail."""
    from memory import get_pool

    pool = await get_pool()
    async with pool.acquire() as conn:
        # Try UUID first, then reference_id
        esc = await conn.fetchrow(
            "SELECT * FROM escalations WHERE id::text = $1 OR reference_id = $1",
            escalation_id,
        )
        if not esc:
            raise HTTPException(404, "Escalation not found")

        messages = await conn.fetch(
            """SELECT role, content, tool_name, tool_args, original_timestamp
                 FROM escalation_messages
                WHERE escalation_id = $1
                ORDER BY original_timestamp""",
            esc["id"],
        )

        audit = await conn.fetch(
            """SELECT action, actor, old_value, new_value, notes, created_at
                 FROM escalation_audit_log
                WHERE escalation_id = $1
                ORDER BY created_at""",
            esc["id"],
        )

    return {
        "escalation": _row_to_dict(esc),
        "messages": [_row_to_dict(m) for m in messages],
        "audit_log": [_row_to_dict(a) for a in audit],
    }


@app.patch("/api/escalations/{escalation_id}")
async def update_escalation(escalation_id: str, body: EscalationUpdate):
    """Update status, assignment, or resolution notes on a ticket."""
    from memory import get_pool

    pool = await get_pool()
    async with pool.acquire() as conn:
        esc = await conn.fetchrow(
            "SELECT * FROM escalations WHERE id::text = $1 OR reference_id = $1",
            escalation_id,
        )
        if not esc:
            raise HTTPException(404, "Escalation not found")

        esc_id = esc["id"]
        updates: list[str] = []
        params: list[Any] = []
        idx = 1

        if body.status:
            old_status = esc["status"]
            updates.append(f"status = ${idx}")
            params.append(body.status)
            idx += 1

            if body.status in ("resolved", "closed"):
                updates.append("resolved_at = NOW()")

            # Audit entry
            await conn.execute(
                """INSERT INTO escalation_audit_log
                       (escalation_id, action, actor, old_value, new_value)
                   VALUES ($1, 'status_change', $2, $3, $4)""",
                esc_id, body.actor, old_status, body.status,
            )

        if body.assigned_to:
            updates.append(f"assigned_to = ${idx}")
            params.append(body.assigned_to)
            idx += 1
            await conn.execute(
                """INSERT INTO escalation_audit_log
                       (escalation_id, action, actor, old_value, new_value)
                   VALUES ($1, 'assigned', $2, $3, $4)""",
                esc_id, body.actor, esc["assigned_to"], body.assigned_to,
            )

        if body.resolution_notes:
            updates.append(f"resolution_notes = ${idx}")
            params.append(body.resolution_notes)
            idx += 1

        if updates:
            params.append(esc_id)
            await conn.execute(
                f"UPDATE escalations SET {', '.join(updates)} WHERE id = ${idx}",
                *params,
            )

    return {"status": "updated", "escalation_id": str(esc_id)}


@app.post("/api/escalations/{escalation_id}/callback")
async def trigger_callback(escalation_id: str, body: CallbackRequest):
    """Trigger an outbound resolution callback to the user."""
    from memory import get_pool

    pool = await get_pool()
    async with pool.acquire() as conn:
        esc = await conn.fetchrow(
            "SELECT * FROM escalations WHERE id::text = $1 OR reference_id = $1",
            escalation_id,
        )
        if not esc:
            raise HTTPException(404, "Escalation not found")

        if not esc.get("resolution_notes"):
            raise HTTPException(400, "Cannot callback without resolution notes. Resolve the ticket first.")

        # Update escalation status
        await conn.execute(
            """UPDATE escalations
                  SET callback_status = 'pending', status = 'awaiting_callback'
                WHERE id = $1""",
            esc["id"],
        )
        await conn.execute(
            """INSERT INTO escalation_audit_log
                   (escalation_id, action, actor, notes)
               VALUES ($1, 'callback_triggered', $2, $3)""",
            esc["id"], body.actor,
            f"Resolution callback requested. Persona: {body.persona}",
        )

    # In production, this would dispatch an outbound call via LiveKit.
    # For Day 7 demo, we mark it as dispatched.
    logger.info(
        "CALLBACK DISPATCHED: escalation=%s user=%s",
        esc["reference_id"], esc["user_id"],
    )

    # Try to dispatch via the outbound trigger system
    callback_result = {"status": "dispatched", "reference_id": esc["reference_id"]}
    try:
        from trigger_call import dispatch_outbound_call
        # This would need the user's phone number — for demo, mark as dispatched
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE escalations SET callback_status = 'dispatched' WHERE id = $1",
                esc["id"],
            )
    except ImportError:
        logger.info("trigger_call not available — marking callback as dispatched")

    return callback_result


@app.get("/api/conversations/{room_name}")
async def get_conversation_log(room_name: str):
    """Get the full conversation log for any room/session."""
    from memory import get_pool

    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT role, content, tool_name, tool_args, persona,
                      sentiment, language, created_at
                 FROM conversation_logs
                WHERE room_name = $1
                ORDER BY created_at""",
            room_name,
        )

    if not rows:
        raise HTTPException(404, f"No conversation logs for room '{room_name}'")

    return {
        "room_name": room_name,
        "message_count": len(rows),
        "messages": [_row_to_dict(r) for r in rows],
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _row_to_dict(row) -> dict[str, Any]:
    """Convert asyncpg Record to JSON-serializable dict."""
    d = dict(row)
    for k, v in d.items():
        if isinstance(v, datetime):
            d[k] = v.isoformat()
        elif hasattr(v, "__iter__") and not isinstance(v, (str, bytes, dict)):
            d[k] = list(v)
    return d


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8081, log_level="info")
