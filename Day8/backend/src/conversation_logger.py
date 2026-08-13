"""
=============================================================================
 VoicePay — Day 7 Conversation Logger
 Real-time per-message logging for EVERY voice session (not just escalations).
=============================================================================

Usage in agent.py:
    logger = ConversationLogger(room_name=ctx.room.name, user_id=uid, persona="anisha")

    # On each final user transcript:
    await logger.log_user_message(transcript, language="hi")

    # On each agent speech commit:
    await logger.log_agent_message(text)

    # Before/after tool invocations:
    await logger.log_tool_call("get_gold_prices", {"metal": "gold"})
    await logger.log_tool_result("get_gold_prices", result_str)

    # For system events:
    await logger.log_system_event("Escalation VP-2026-10001 created")

All inserts are fire-and-forget async — they do NOT block TTS or LLM.
Failures log a warning and are silently swallowed (a lost log line is better
than a crashed voice session).
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("voicepay.conv_logger")


class ConversationLogger:
    """Lightweight per-session logger that writes to conversation_logs table."""

    __slots__ = ("room_name", "user_id", "persona", "_pool_getter")

    def __init__(
        self,
        room_name: str,
        user_id: str | None = None,
        persona: str | None = None,
    ):
        self.room_name = room_name
        self.user_id = user_id
        self.persona = persona

    # ------------------------------------------------------------------
    # Public logging methods
    # ------------------------------------------------------------------
    async def log_user_message(
        self, content: str, language: str = "en", sentiment: str | None = None
    ) -> None:
        """Log a transcribed user utterance."""
        if not content or not content.strip():
            return
        await self._insert(
            role="user", content=content.strip(),
            language=language, sentiment=sentiment,
        )

    async def log_agent_message(self, content: str) -> None:
        """Log an agent response (committed speech)."""
        if not content or not content.strip():
            return
        await self._insert(role="agent", content=content.strip())

    async def log_tool_call(
        self, tool_name: str, args: dict[str, Any] | None = None
    ) -> None:
        """Log a tool invocation with its arguments."""
        await self._insert(
            role="tool_call",
            content=f"Called: {tool_name}",
            tool_name=tool_name,
            tool_args=args,
        )

    async def log_tool_result(self, tool_name: str, result: str) -> None:
        """Log a tool result (truncated to 1000 chars)."""
        await self._insert(
            role="tool_result",
            content=(result[:1000] if result else "(empty)"),
            tool_name=tool_name,
        )

    async def log_system_event(self, content: str) -> None:
        """Log a system-level event (escalation, voice switch, etc.)."""
        await self._insert(role="system", content=content)

    # ------------------------------------------------------------------
    # Internal INSERT — fire-and-forget, never crashes the session
    # ------------------------------------------------------------------
    async def _insert(
        self,
        *,
        role: str,
        content: str,
        tool_name: str | None = None,
        tool_args: dict[str, Any] | None = None,
        sentiment: str | None = None,
        language: str | None = None,
    ) -> None:
        try:
            # Import here to avoid circular imports at module level
            from memory import get_pool

            pool = await get_pool()
            async with pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO conversation_logs
                        (room_name, user_id, persona, role, content,
                         tool_name, tool_args, sentiment, language)
                    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
                    """,
                    self.room_name,
                    self.user_id,
                    self.persona,
                    role,
                    content,
                    tool_name,
                    _jsonb(tool_args),
                    sentiment,
                    language,
                )
        except Exception as exc:
            # Non-fatal: log and move on
            logger.warning("conv_log insert failed (room=%s): %s", self.room_name, exc)


def _jsonb(d: dict | None) -> str | None:
    """Convert dict to JSON string for asyncpg jsonb param, or None."""
    if d is None:
        return None
    import json
    return json.dumps(d, default=str)
