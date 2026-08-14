"""
VoicePay Handoff Orchestration
==============================
Persists handoff events to Postgres and manages session-end analytics.
All functions are fire-and-forget safe — they log errors but never raise.
"""

from __future__ import annotations

import json as _json
import logging
from typing import Any

from state import VoicePayState

logger = logging.getLogger("voicepay.handoff")


async def persist_handoff(state: VoicePayState, to_agent: str) -> None:
    """Persist the latest handoff event to agent_handoffs table."""
    if not state.handoff_history:
        return
    last = state.handoff_history[-1]
    try:
        from memory import get_pool

        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO agent_handoffs
                    (room_name, user_id, from_agent, to_agent, reason,
                     context_summary, handoff_index)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                """,
                state.room_name,
                state.user_id or None,
                last.from_agent,
                last.to_agent,
                last.reason,
                last.context_summary or None,
                state.handoff_count - 1,
            )
        logger.info(
            "handoff persisted: %s → %s (idx=%d)",
            last.from_agent,
            last.to_agent,
            state.handoff_count - 1,
        )
    except Exception as e:
        logger.warning("persist_handoff failed (non-fatal): %s", e)


async def persist_session_end_analytics(state: VoicePayState) -> None:
    """Update call_analytics with multi-agent columns at session end."""
    try:
        from memory import get_pool

        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE call_analytics
                SET handoff_count = $2,
                    agents_used = $3,
                    primary_agent = $4,
                    handoff_timeline = $5::jsonb
                WHERE room_name = $1
                """,
                state.room_name,
                state.handoff_count,
                state.agents_used(),
                state.primary_agent(),
                _json.dumps(state.handoff_timeline_json()),
            )
        logger.info(
            "session-end analytics updated: room=%s handoffs=%d agents=%s",
            state.room_name,
            state.handoff_count,
            state.agents_used(),
        )
    except Exception as e:
        logger.warning("persist_session_end_analytics failed (non-fatal): %s", e)


async def update_agent_metrics(agent_name: str, tool_calls: int = 0, tool_errors: int = 0) -> None:
    """Increment per-agent daily metrics (upsert)."""
    try:
        from memory import get_pool

        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO agent_metrics (agent_name, total_activations, tool_calls, tool_errors)
                VALUES ($1, 1, $2, $3)
                ON CONFLICT (date, agent_name)
                DO UPDATE SET
                    total_activations = agent_metrics.total_activations + 1,
                    tool_calls = agent_metrics.tool_calls + EXCLUDED.tool_calls,
                    tool_errors = agent_metrics.tool_errors + EXCLUDED.tool_errors
                """,
                agent_name,
                tool_calls,
                tool_errors,
            )
    except Exception as e:
        logger.warning("update_agent_metrics failed (non-fatal): %s", e)
