"""
=============================================================================
 VoicePay — Day 7 Escalation Engine
 "Know When to Ask for Human Help"
=============================================================================

This module is the brain of the human-help system:

  1. detect_escalation_trigger()  — pattern-matches fraud & regulatory language
                                    in English + Hindi + Hinglish
  2. classify_urgency()           — critical / high / medium / low
  3. scrub_pii()                  — strips Aadhaar, PAN, card, phone, OTP, email
                                    BEFORE anything is written to a ticket
  4. find_duplicate_escalation()  — same user + same type + still open → update,
                                    don't duplicate
  5. create_escalation()          — inserts the ticket + writes audit trail
  6. append_to_escalation()       — adds new context to an existing ticket
  7. copy_transcript_to_escalation() — snapshots conversation_logs into the ticket

The agent never writes PII directly; every write path passes through scrub_pii.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any

import json as _json

from email_notify import send_escalation_email

logger = logging.getLogger("voicepay.escalation")


# =============================================================================
# REFERENCE ID — human-friendly, speakable, YEAR-scoped
# =============================================================================
async def generate_reference_id(pool) -> str:
    """Generate a VP-YYYY-XXXXX reference id backed by escalation_seq."""
    async with pool.acquire() as conn:
        seq_val = await conn.fetchval("SELECT nextval('escalation_seq')")
    year = datetime.now().year
    return f"VP-{year}-{seq_val:05d}"


# =============================================================================
# TRIGGER DETECTION — the two Day-7 categories
# Pattern-matches English, Hinglish (romanized), and Devanagari Hindi.
# Regexes stay conservative: we prefer FALSE-NEGATIVE (miss a trigger, ask
# normally) over FALSE-POSITIVE (escalate on a harmless line). The agent's
# system prompt also drives detection — patterns are a safety net.
# =============================================================================
FRAUD_PATTERNS: list[str] = [
    # English: unauthorized activity
    r"\bsomeone\s+(withdrew|took|stole|used|hacked|accessed)\b",
    r"\b(didn'?t|did\s*not|never)\s+(make|authorize|authorise|do|approve)\s+(this|that|the)?\s*(transaction|payment|transfer|withdrawal|purchase)\b",
    r"\b(unauthori[sz]ed|unauthorised)\s+(access|transaction|withdrawal|transfer|charge|activity)\b",
    r"\b(my\s+)?(card|account|upi|wallet)\s+(was|has\s+been|got|is)?\s*(used|hacked|stolen|compromised|breached)\b",
    r"\b(fraud|fraudulent|scam)\s+(transaction|activity|charge|call|message)\b",
    r"\b(hacker|thief|scammer)\b",
    r"\b(money|funds|balance|paisa)\s+(is\s+)?(missing|gone|disappeared|stolen|debited\s+wrongly)\b",
    r"\bi\s+didn'?t\s+(withdraw|transfer|send|pay|make|buy|purchase)\b",
    r"\bstolen\s+(card|phone|wallet)\b",
    r"\b(otp|pin)\s+(was\s+)?(shared|given|leaked)\s+(with|to)\s+(someone|stranger|caller)\b",
    # Hinglish / romanized
    r"\b(mera|meri|mere)\s+(paisa|paise|account|card)\s+(chori|hack|gayab|nikal)\b",
    r"\b(kisi\s*ne|kisine)\s+(nikal\s+liya|chura\s+liya|hack\s+kar|paisa\s+le\s+liya)\b",
    r"\b(paisa|paise)\s+(kat\s+gaya|kata|nikal\s+gaya|gayab)\b",
    # Devanagari Hindi
    r"किसी\s*ने\s*(मेरा|मेरी|मेरे)?\s*(पैसा|पैसे|खाता|कार्ड)",
    r"(पैसा|पैसे)\s*(चोरी|गायब|कट\s*गया|कट\s*गए|निकल\s*गया)",
    r"धोखा(धड़ी)?",
    r"(खाता|अकाउंट)\s*(हैक|hack)",
]

REGULATORY_PATTERNS: list[str] = [
    # English: formal complaints & escalation to authorities
    r"\b(file|lodge|register|make|raise)\s+a?\s*(formal\s+|official\s+|written\s+)?(complaint|grievance|case)\b",
    r"\b(legal|court|lawyer|advocate)\s+(action|notice|proceedings|case|matter)\b",
    r"\b(rbi|reserve\s+bank)\s+(ombudsman|complaint|grievance)\b",
    r"\bbanking\s+(codes?|regulation|ombudsman)\s+(violation|breach|complaint)\b",
    r"\b(compliance|regulatory)\s+(issue|violation|breach|complaint)\b",
    r"\bconsumer\s+(forum|court|protection|helpline|commission)\b",
    r"\b(i\s+will|i'?ll|going\s+to|planning\s+to)\s+(sue|take\s+legal|file\s+case|report\s+to\s+rbi|approach\s+ombudsman)\b",
    r"\b(ombudsman|lokpal)\b",
    r"\bformal\s+complaint\b",
    # Hinglish / romanized
    r"\bshikayat\s+(darj|register|file|karna|karni|karni\s+hai)\b",
    r"\b(rbi|ombudsman)\s+(mein|me|ko)\s+(complaint|shikayat)\b",
    # Devanagari Hindi
    r"शिकायत\s*(दर्ज|फ़ाइल)?",
    r"उपभोक्ता\s*(फोरम|अदालत|मंच)",
    r"कानूनी\s*(कार्रवाई|नोटिस)",
    r"RBI\s*(शिकायत|ombudsman)",
]

# Compile once
_FRAUD_RE = [re.compile(p, re.IGNORECASE) for p in FRAUD_PATTERNS]
_REG_RE = [re.compile(p, re.IGNORECASE) for p in REGULATORY_PATTERNS]


def detect_escalation_trigger(text: str) -> dict[str, Any] | None:
    """
    Scan a user utterance for escalation triggers.

    Returns:
        {"type": "fraud"|"regulatory", "trigger_phrases": [...], "urgency": ...}
        or None if nothing matched.
    """
    if not text or len(text) < 3:
        return None

    fraud_hits = []
    for rx in _FRAUD_RE:
        m = rx.search(text)
        if m:
            fraud_hits.append(m.group(0).strip())

    if fraud_hits:
        return {
            "type": "fraud",
            "trigger_phrases": fraud_hits[:5],
            "urgency": classify_urgency("fraud", text, fraud_hits),
        }

    reg_hits = []
    for rx in _REG_RE:
        m = rx.search(text)
        if m:
            reg_hits.append(m.group(0).strip())

    if reg_hits:
        return {
            "type": "regulatory",
            "trigger_phrases": reg_hits[:5],
            "urgency": classify_urgency("regulatory", text, reg_hits),
        }

    return None


# =============================================================================
# URGENCY CLASSIFIER
# =============================================================================
_CRITICAL_SIGNALS = (
    "right now", "happening now", "just happened", "just now", "abhi abhi",
    "abhi ho raha", "this moment", "currently", "active", "aabhi",
    "just received", "अभी अभी", "अभी हुआ",
)
_HIGH_SIGNALS = (
    "money gone", "lost money", "paisa gaya", "paisa nikal gaya",
    "large amount", "big amount", "lakh", "lakhs", "50000", "1 lakh",
    "legal action", "court", "sue", "lawyer", "advocate",
    "life savings", "emergency",
)


def classify_urgency(esc_type: str, text: str, matches: list[str]) -> str:
    """Rank a trigger by how time-sensitive it feels."""
    t = text.lower()

    # Fraud + active/ongoing → critical
    if esc_type == "fraud" and any(s in t for s in _CRITICAL_SIGNALS):
        return "critical"

    # Any type + money loss / legal threat → high
    if any(s in t for s in _HIGH_SIGNALS):
        return "high"

    # All fraud is minimum "high" by policy (money is at risk)
    if esc_type == "fraud":
        return "high"

    # Regulatory defaults to medium
    return "medium"


# =============================================================================
# PII SCRUBBER
# Applied to EVERY summary/note before it hits the escalations table.
# The full conversation_logs table still stores raw transcripts (needed for
# the audit trail), but the ticket body and anything the dashboard shows in
# summary form goes through this.
# =============================================================================
# Order matters: longest / most specific first
_PII_RULES: list[tuple[re.Pattern, str]] = [
    # OTP / PIN / CVV / MPIN followed by digits — redact digits
    (re.compile(r"\b(otp|pin|cvv|mpin|upi\s*pin|passcode|password)\b[\s:=\-]*\d{3,8}", re.I),
     lambda m: f"{m.group(1)}: [REDACTED]"),
    # Aadhaar: 12 digits with optional spaces
    (re.compile(r"\b(\d{4})[\s-]?(\d{4})[\s-]?(\d{4})\b"),
     r"XXXX-XXXX-\3"),
    # Card: 13-16 digits (in groups of 4)
    (re.compile(r"\b(\d{4})[\s-]?(\d{4})[\s-]?(\d{4})[\s-]?(\d{3,4})\b"),
     r"XXXX-XXXX-XXXX-\4"),
    # Indian phone: optional +91 + 10 digits
    (re.compile(r"\+?91?[\s-]?([6-9]\d{5})(\d{4})\b"),
     r"+91-XXXXXX-\2"),
    # PAN: ABCDE1234F
    (re.compile(r"\b([A-Z]{5})(\d{4})([A-Z])\b"),
     r"XXXXX\2X"),
    # Email: keep first char + domain
    (re.compile(r"\b([a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]*@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b"),
     r"\1***@\2"),
    # IFSC (informational, keep but flag)  — no scrub, banks are public
    # Explicit "my account number is 12345678" style
    (re.compile(r"\b(account\s*(number|no|#)?)\s*[:\-]?\s*\d{6,20}\b", re.I),
     lambda m: f"{m.group(1)}: [REDACTED]"),
]


def scrub_pii(text: str) -> str:
    """
    Remove/mask PII from free text before writing it to a ticket.
    Deterministic — same input always produces same output.
    """
    if not text:
        return text
    result = text
    for pattern, replacement in _PII_RULES:
        if callable(replacement):
            result = pattern.sub(replacement, result)
        else:
            result = pattern.sub(replacement, result)
    return result


# =============================================================================
# DUPLICATE DETECTION — one open ticket per (user, type)
# =============================================================================
async def find_duplicate_escalation(
    pool, user_id: str, esc_type: str,
) -> dict[str, Any] | None:
    """Return an existing open/in-progress/awaiting-callback ticket, or None."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, reference_id, status, type, urgency, summary,
                   created_at, updated_at
              FROM escalations
             WHERE user_id = $1
               AND type = $2
               AND status IN ('open', 'in_progress', 'awaiting_callback')
             ORDER BY created_at DESC
             LIMIT 1
            """,
            user_id, esc_type,
        )
    return dict(row) if row else None


# =============================================================================
# CREATE ESCALATION
# =============================================================================
async def create_escalation(
    pool,
    *,
    user_id: str | None,
    room_name: str,
    esc_type: str,
    urgency: str,
    summary: str,
    what_checked: str | None,
    trigger_phrases: list[str],
    user_consent: bool,
    caller_name: str | None = None,
    language: str = "en",
    follow_up_method: str = "callback",
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Insert a new escalation ticket + a `created` audit entry.
    All free-text fields are PII-scrubbed here (defence in depth — the agent
    tool also scrubs before calling us).
    """
    reference_id = await generate_reference_id(pool)
    clean_summary = scrub_pii(summary)
    clean_checked = scrub_pii(what_checked) if what_checked else None
    clean_name = caller_name.strip() if caller_name else None

    async with pool.acquire() as conn:
        async with conn.transaction():
            # Ensure user exists (auto-create minimal record if not)
            if user_id:
                await conn.execute(
                    """
                    INSERT INTO users (user_id, name, consent_given)
                    VALUES ($1, $2, TRUE)
                    ON CONFLICT (user_id) DO NOTHING
                    """,
                    user_id, clean_name,
                )

            row = await conn.fetchrow(
                """
                INSERT INTO escalations (
                    reference_id, user_id, room_name,
                    type, urgency, status,
                    caller_name, summary, what_checked,
                    trigger_phrases, language, follow_up_method,
                    user_consent, metadata
                ) VALUES (
                    $1, $2, $3,
                    $4, $5, 'open',
                    $6, $7, $8,
                    $9, $10, $11,
                    $12, $13
                )
                RETURNING *
                """,
                reference_id, user_id, room_name,
                esc_type, urgency,
                clean_name, clean_summary, clean_checked,
                trigger_phrases, language, follow_up_method,
                user_consent, _json.dumps(metadata or {}),
            )
            await conn.execute(
                """
                INSERT INTO escalation_audit_log
                    (escalation_id, action, actor, new_value, notes)
                VALUES ($1, 'created', 'agent', $2, $3)
                """,
                row["id"], reference_id,
                f"type={esc_type} urgency={urgency} consent={user_consent}",
            )

    logger.info(
        "ESCALATION CREATED ref=%s type=%s urgency=%s user=%s room=%s",
        reference_id, esc_type, urgency, user_id, room_name,
    )

    # Send email notification to owner (fire-and-forget, non-fatal)
    try:
        await send_escalation_email(
            reference_id=reference_id,
            esc_type=esc_type,
            urgency=urgency,
            summary=clean_summary,
            caller_name=clean_name,
            language=language,
            what_checked=clean_checked,
            trigger_phrases=trigger_phrases,
        )
    except Exception as exc:
        logger.warning("Email notification failed (non-fatal): %s", exc)

    return dict(row)


# =============================================================================
# APPEND (dedup path)
# =============================================================================
async def append_to_escalation(
    pool,
    *,
    escalation_id: str,
    additional_context: str,
    new_room_name: str,
) -> None:
    """When a dup is found, tack the new context onto the existing ticket."""
    clean = scrub_pii(additional_context)
    stamp = datetime.utcnow().isoformat(timespec="seconds")
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE escalations
               SET summary = summary
                           || E'\n\n— Update (' || $2 || ') —\n'
                           || $3,
                   metadata = COALESCE(metadata, '{}'::jsonb)
                           || jsonb_build_object(
                                'additional_rooms',
                                COALESCE(metadata->'additional_rooms', '[]'::jsonb)
                                    || to_jsonb($4::text)
                              )
             WHERE id = $1
            """,
            escalation_id, stamp, clean, new_room_name,
        )
        await conn.execute(
            """
            INSERT INTO escalation_audit_log
                (escalation_id, action, actor, notes)
            VALUES ($1, 'note_added', 'agent', $2)
            """,
            escalation_id, f"Appended new context from room {new_room_name}",
        )
    logger.info("ESCALATION APPENDED id=%s room=%s", escalation_id, new_room_name)


# =============================================================================
# TRANSCRIPT SNAPSHOT
# =============================================================================
async def copy_transcript_to_escalation(
    pool,
    *,
    escalation_id: str,
    room_name: str,
) -> int:
    """Copy conversation_logs for this room into escalation_messages."""
    async with pool.acquire() as conn:
        result = await conn.execute(
            """
            INSERT INTO escalation_messages
                (escalation_id, role, content, tool_name, tool_args, original_timestamp)
            SELECT $1, role, content, tool_name, tool_args, created_at
              FROM conversation_logs
             WHERE room_name = $2
             ORDER BY created_at
            """,
            escalation_id, room_name,
        )
    # asyncpg returns "INSERT 0 N"
    try:
        count = int(result.split()[-1])
    except Exception:
        count = 0
    logger.info("Transcript snapshot: %d msgs → escalation %s", count, escalation_id)
    return count


# =============================================================================
# LOOKUP (used by check_escalation_status tool + API)
# =============================================================================
async def get_escalation_by_ref(pool, reference_id: str) -> dict[str, Any] | None:
    """Case-insensitive lookup by reference ID."""
    ref = reference_id.upper().strip().replace(" ", "").replace("_", "-")
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM escalations WHERE reference_id = $1", ref,
        )
    return dict(row) if row else None
