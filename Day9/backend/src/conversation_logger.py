"""
=============================================================================
 VoicePay — Day 8 Conversation Logger
 Real-time per-message logging for EVERY voice session.
 ALL content is PII-scrubbed before storage.
=============================================================================
"""

from __future__ import annotations

import logging
import re
from typing import Any

logger = logging.getLogger("voicepay.conv_logger")


# =============================================================================
# PII SCRUBBER — strips credentials from ALL logged content
# =============================================================================
_PII_SCRUB_RULES = [
    # OTP / PIN / CVV / MPIN followed by digits
    (re.compile(r"\b(otp|pin|cvv|mpin|upi\s*pin|passcode|password)\b[\s:=\-]*\d{3,8}", re.I),
     lambda m: f"{m.group(1)}: XXXXXXXX"),
    # Aadhaar: 12 digits
    (re.compile(r"\b(\d{4})[\s-]?(\d{4})[\s-]?(\d{4})\b"), r"XXXX-XXXX-XXXX"),
    # Card: 13-16 digits
    (re.compile(r"\b(\d{4})[\s-]?(\d{4})[\s-]?(\d{4})[\s-]?(\d{3,4})\b"), r"XXXX-XXXX-XXXX-XXXX"),
    # Indian phone: +91 + 10 digits
    (re.compile(r"\+?91?[\s-]?([6-9]\d{5})(\d{4})\b"), r"+91-XXXXXX-\2"),
    # PAN: ABCDE1234F
    (re.compile(r"\b([A-Z]{5})(\d{4})([A-Z])\b"), r"XXXXX0000X"),
    # Email
    (re.compile(r"\b([a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]*@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b"),
     r"\1***@\2"),
    # Account number patterns (6-18 digits after keyword)
    (re.compile(r"\b(account\s*(number|no|#)?)\s*[:\-]?\s*\d{6,18}\b", re.I),
     lambda m: f"{m.group(1)}: XXXXXXXX"),
    # Standalone 4-6 digit sequences that look like OTPs (near sensitive context)
    (re.compile(r"\b(my\s+(?:otp|pin|cvv|password|code)\s+(?:is|was))\s*\d{4,6}\b", re.I),
     lambda m: f"{m.group(1)} XXXXXXXX"),
]


def scrub_content(text: str) -> str:
    """Remove ALL PII/credentials from text before logging."""
    if not text:
        return text
    result = text
    for pattern, replacement in _PII_SCRUB_RULES:
        if callable(replacement):
            result = pattern.sub(replacement, result)
        else:
            result = pattern.sub(replacement, result)
    return result


class ConversationLogger:
    """Lightweight per-session logger that writes to conversation_logs table.
    ALL content is PII-scrubbed before storage."""

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
    # Public logging methods — ALL scrub PII before storage
    # ------------------------------------------------------------------
    async def log_user_message(
        self, content: str, language: str = "en", sentiment: str | None = None
    ) -> None:
        """Log a transcribed user utterance (PII-scrubbed)."""
        if not content or not content.strip():
            return
        await self._insert(
            role="user", content=scrub_content(content.strip()),
            language=language, sentiment=sentiment,
        )

    async def log_agent_message(self, content: str) -> None:
        """Log an agent response (PII-scrubbed)."""
        if not content or not content.strip():
            return
        await self._insert(role="agent", content=scrub_content(content.strip()))

    async def log_tool_call(
        self, tool_name: str, args: dict[str, Any] | None = None
    ) -> None:
        """Log a tool invocation with its arguments (PII-scrubbed)."""
        # Day 9: Scrub PII from tool arguments before DB storage
        scrubbed_args = None
        if args:
            scrubbed_args = {k: scrub_content(str(v)) for k, v in args.items()}
        await self._insert(
            role="tool_call",
            content=f"Called: {tool_name}",
            tool_name=tool_name,
            tool_args=scrubbed_args,
        )

    async def log_tool_result(self, tool_name: str, result: str) -> None:
        """Log a tool result (truncated to 1000 chars, PII-scrubbed)."""
        await self._insert(
            role="tool_result",
            content=scrub_content((result[:1000] if result else "(empty)")),
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
            logger.warning("conv_log insert failed (room=%s): %s", self.room_name, exc)


def _jsonb(d: dict | None) -> str | None:
    """Convert dict to JSON string for asyncpg jsonb param, or None."""
    if d is None:
        return None
    import json
    return json.dumps(d, default=str)
