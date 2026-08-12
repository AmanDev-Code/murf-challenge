"""
VoicePay Memory Layer — Async Postgres with connection pooling.

Provides fast, non-blocking user lookup and fact storage via asyncpg.
All queries use parameterized statements for safety and speed.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Any

import asyncpg

logger = logging.getLogger("voicepay.memory")

# Global connection pool — initialized once per worker process
_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    """Get or create the connection pool (lazy singleton)."""
    global _pool
    if _pool is None:
        dsn = os.environ.get(
            "DATABASE_URL",
            "postgresql://voicepay:voicepay_dev_2026@localhost:5432/voicepay",
        )
        _pool = await asyncpg.create_pool(
            dsn,
            min_size=2,
            max_size=10,
            command_timeout=5.0,  # 5s max per query — no waiting
        )
        logger.info("Postgres pool created (min=2, max=10)")
    return _pool


async def close_pool() -> None:
    """Gracefully close the pool on shutdown."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("Postgres pool closed")


# =============================================================================
# USER LOOKUP — called async on session connect (no blocking)
# =============================================================================
async def lookup_user(user_id: str) -> dict[str, Any] | None:
    """
    Look up a user by ID. Returns user dict with facts, or None if new.
    Designed to complete in <5ms on indexed Postgres.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Fetch user record
        user_row = await conn.fetchrow(
            "SELECT * FROM users WHERE user_id = $1", user_id
        )
        if not user_row:
            return None

        return await _build_user_dict(conn, user_row)


async def lookup_user_by_name(name: str) -> dict[str, Any] | None:
    """
    Look up a user by name (case-insensitive). Returns the most recently
    active user with that name. Used when participant ID doesn't match
    (random IDs change every session).
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        user_row = await conn.fetchrow(
            "SELECT * FROM users WHERE LOWER(name) = LOWER($1) ORDER BY last_interaction DESC LIMIT 1",
            name,
        )
        if not user_row:
            return None

        return await _build_user_dict(conn, user_row)


async def _build_user_dict(conn: Any, user_row: Any) -> dict[str, Any]:
    """Build user dict with facts and last conversation from a DB row."""
    user_id = user_row["user_id"]

    # Fetch all facts
    fact_rows = await conn.fetch(
        "SELECT fact_key, fact_value, updated_at FROM user_facts WHERE user_id = $1 ORDER BY updated_at DESC",
        user_id,
    )

    # Fetch last conversation summary
    last_conv = await conn.fetchrow(
        "SELECT summary, topics, created_at FROM conversation_summaries WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
        user_id,
    )

    facts = {row["fact_key"]: row["fact_value"] for row in fact_rows}

    return {
        "user_id": user_row["user_id"],
        "name": user_row["name"],
        "language_pref": user_row["language_pref"],
        "persona_pref": user_row["persona_pref"],
        "total_calls": user_row["total_calls"],
        "last_interaction": user_row["last_interaction"].isoformat() if user_row["last_interaction"] else None,
        "consent_given": user_row["consent_given"],
        "facts": facts,
        "last_conversation": {
            "summary": last_conv["summary"],
            "topics": list(last_conv["topics"]) if last_conv["topics"] else [],
            "date": last_conv["created_at"].isoformat(),
        } if last_conv else None,
    }


# =============================================================================
# SAVE USER — create or update user record
# =============================================================================
async def save_user(
    user_id: str,
    name: str | None = None,
    language_pref: str | None = None,
    persona_pref: str | None = None,
    consent_given: bool = False,
) -> dict[str, Any]:
    """
    Create or update a user record. Uses UPSERT for idempotency.
    Returns the saved user dict.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO users (user_id, name, language_pref, persona_pref, consent_given, total_calls)
            VALUES ($1, $2, $3, $4, $5, 1)
            ON CONFLICT (user_id) DO UPDATE SET
                name = COALESCE($2, users.name),
                language_pref = COALESCE($3, users.language_pref),
                persona_pref = COALESCE($4, users.persona_pref),
                consent_given = CASE WHEN $5 THEN TRUE ELSE users.consent_given END,
                total_calls = users.total_calls + 1,
                last_interaction = NOW(),
                updated_at = NOW()
            RETURNING *
            """,
            user_id, name, language_pref, persona_pref, consent_given,
        )
        logger.info("save_user: id=%s name=%s consent=%s", user_id, name, consent_given)
        return dict(row)


# =============================================================================
# SAVE FACTS — store key-value facts about a user (UPSERT)
# =============================================================================
async def save_facts(user_id: str, facts: dict[str, str]) -> int:
    """
    Save multiple facts for a user. Uses UPSERT — existing keys get updated.
    Returns number of facts saved.

    IMPORTANT: Never store sensitive data (account numbers, Aadhaar, PAN, OTP, etc.)
    """
    if not facts:
        return 0

    pool = await get_pool()
    count = 0
    async with pool.acquire() as conn:
        # Use a transaction for batch insert
        async with conn.transaction():
            for key, value in facts.items():
                await conn.execute(
                    """
                    INSERT INTO user_facts (user_id, fact_key, fact_value)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (user_id, fact_key) DO UPDATE SET
                        fact_value = $3,
                        updated_at = NOW()
                    """,
                    user_id, key, value,
                )
                count += 1

    logger.info("save_facts: user=%s count=%d keys=%s", user_id, count, list(facts.keys()))
    return count


# =============================================================================
# SAVE CONVERSATION SUMMARY — brief record of each call
# =============================================================================
async def save_conversation_summary(
    user_id: str,
    room_name: str,
    summary: str,
    topics: list[str] | None = None,
    tools_used: list[str] | None = None,
    duration_s: int = 0,
) -> None:
    """Save a conversation summary for future context."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO conversation_summaries (user_id, room_name, summary, topics, tools_used, duration_s)
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            user_id, room_name, summary, topics or [], tools_used or [], duration_s,
        )
    logger.info("save_conversation_summary: user=%s room=%s", user_id, room_name)


# =============================================================================
# FORGET USER — complete data deletion (GDPR-style)
# =============================================================================
async def forget_user(user_id: str) -> bool:
    """
    Completely delete a user and all their data.
    Returns True if user existed and was deleted, False if not found.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        # CASCADE handles user_facts and conversation_summaries
        result = await conn.execute(
            "DELETE FROM users WHERE user_id = $1", user_id
        )
        deleted = result == "DELETE 1"
        logger.info("forget_user: id=%s deleted=%s", user_id, deleted)
        return deleted


# =============================================================================
# UPDATE LAST INTERACTION — lightweight touch on each call
# =============================================================================
async def touch_user(user_id: str) -> None:
    """Update last_interaction timestamp and increment call count."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE users SET last_interaction = NOW(), total_calls = total_calls + 1, updated_at = NOW()
            WHERE user_id = $1
            """,
            user_id,
        )


# =============================================================================
# OUTBOUND CALL LOGGING (Day 6)
# =============================================================================

async def log_call_outcome(
    user_id: str | None,
    phone_number: str,
    purpose: str,
    outcome: str,
    duration_s: int = 0,
    attempt: int = 1,
    persona: str = "anisha",
    summary: str = "",
) -> None:
    """Log an outbound call outcome to call_logs table."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO call_logs (user_id, phone_number, purpose, outcome, duration_seconds, attempt_number, agent_persona, conversation_summary)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """,
            user_id, phone_number, purpose, outcome, duration_s, attempt, persona, summary,
        )
    logger.info("call_log: phone=%s outcome=%s duration=%ds purpose=%s", phone_number, outcome, duration_s, purpose)


async def get_call_attempts_today(phone_number: str) -> int:
    """Count how many times we've called this number today."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        count = await conn.fetchval(
            """
            SELECT COUNT(*) FROM call_logs
            WHERE phone_number = $1 AND created_at >= CURRENT_DATE
            """,
            phone_number,
        )
        return count or 0


async def mark_opted_out(user_id: str) -> None:
    """Mark a user as opted out of outbound calls."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE users SET opted_out = TRUE, updated_at = NOW() WHERE user_id = $1",
            user_id,
        )
    logger.info("opted_out: user=%s", user_id)


async def is_opted_out(user_id: str) -> bool:
    """Check if user has opted out of outbound calls."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await conn.fetchval(
            "SELECT opted_out FROM users WHERE user_id = $1",
            user_id,
        )
        return bool(result)
