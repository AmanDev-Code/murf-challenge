"""
VoicePay — Outbound Call Trigger (Day 6)
FastAPI server + CLI to initiate outbound calls via LiveKit dispatch.

Usage:
    # As API server:
    uvicorn trigger_call:app --host 0.0.0.0 --port 8080

    # As CLI:
    python src/trigger_call.py call --phone +919876543210 --name Aman --purpose scheme_reminder
    python src/trigger_call.py campaign
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import sys
from datetime import datetime, timezone, timedelta
from typing import Any

from dotenv import load_dotenv

load_dotenv(".env.local")

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger("voicepay.trigger")

# IST timezone offset
IST = timezone(timedelta(hours=5, minutes=30))

# DND hours — don't call before 9 AM or after 9 PM IST
DND_START_HOUR = 21  # 9 PM
DND_END_HOUR = 9     # 9 AM

# Max attempts per phone per day
MAX_DAILY_ATTEMPTS = 3

# Valid purposes
VALID_PURPOSES = [
    "scheme_reminder", "emi_reminder", "fd_maturity",
    "scam_alert", "follow_up", "general_reminder",
]


def validate_phone(phone: str) -> str | None:
    """Validate E.164 phone number format. Returns cleaned number or None."""
    cleaned = re.sub(r"[\s\-\(\)]", "", phone)
    if not cleaned.startswith("+"):
        # Assume Indian number
        if cleaned.startswith("0"):
            cleaned = "+91" + cleaned[1:]
        elif len(cleaned) == 10:
            cleaned = "+91" + cleaned
        else:
            cleaned = "+" + cleaned
    if re.match(r"^\+\d{10,15}$", cleaned):
        return cleaned
    return None


def is_dnd_hours() -> bool:
    """Check if current time is in DND (Do Not Disturb) hours in IST."""
    now_ist = datetime.now(IST)
    return now_ist.hour >= DND_START_HOUR or now_ist.hour < DND_END_HOUR


async def dispatch_outbound_call(
    phone_number: str,
    user_name: str = "User",
    purpose: str = "general_reminder",
    persona: str = "anisha",
    language: str = "en",
    facts: dict[str, Any] | None = None,
    user_id: str | None = None,
    attempt: int = 1,
    force: bool = False,
) -> dict[str, Any]:
    """Dispatch an outbound call via LiveKit agent dispatch.

    Returns:
        Dict with status, dispatch_id, and any error message.
    """
    from livekit import api

    # --- Validation ---
    clean_phone = validate_phone(phone_number)
    if not clean_phone:
        return {"status": "error", "message": f"Invalid phone number format: {phone_number}"}

    if purpose not in VALID_PURPOSES:
        return {"status": "error", "message": f"Invalid purpose: {purpose}. Valid: {VALID_PURPOSES}"}

    # --- DND check ---
    if is_dnd_hours() and not force:
        now_ist = datetime.now(IST)
        return {
            "status": "rejected",
            "message": f"DND hours active (9 PM - 9 AM IST). Current time: {now_ist.strftime('%I:%M %p')} IST. Use force=true to override.",
        }

    # --- Check daily attempt limit ---
    try:
        from memory import get_call_attempts_today
        attempts = await get_call_attempts_today(clean_phone)
        if attempts >= MAX_DAILY_ATTEMPTS and not force:
            return {
                "status": "rejected",
                "message": f"Max daily attempts ({MAX_DAILY_ATTEMPTS}) reached for {clean_phone}. Already called {attempts} times today.",
            }
    except Exception as e:
        logger.warning("Could not check daily attempts (DB may be down): %s", e)

    # --- Check opt-out ---
    if user_id:
        try:
            from memory import is_opted_out
            if await is_opted_out(user_id):
                return {
                    "status": "rejected",
                    "message": f"User {user_id} has opted out of outbound calls.",
                }
        except Exception as e:
            logger.warning("Could not check opt-out status: %s", e)

    # --- Dispatch the call ---
    metadata = json.dumps({
        "phone_number": clean_phone,
        "user_name": user_name,
        "purpose": purpose,
        "persona": persona,
        "language": language,
        "facts": facts or {},
        "user_id": user_id,
        "attempt": attempt,
        "triggered_at": datetime.now(IST).isoformat(),
    })

    room_name = f"outbound-{clean_phone.replace('+', '')}-{int(datetime.now().timestamp())}"

    try:
        lkapi = api.LiveKitAPI()
        dispatch = await lkapi.agent_dispatch.create_dispatch(
            api.CreateAgentDispatchRequest(
                agent_name="voicepay-outbound",
                room=room_name,
                metadata=metadata,
            )
        )
        await lkapi.aclose()

        logger.info(
            "DISPATCH CREATED: room=%s phone=%s purpose=%s",
            room_name, clean_phone, purpose,
        )

        return {
            "status": "dispatched",
            "room_name": room_name,
            "phone_number": clean_phone,
            "purpose": purpose,
            "dispatch_id": dispatch.id if hasattr(dispatch, 'id') else room_name,
            "message": f"Call dispatched to {user_name} at {clean_phone}",
        }

    except Exception as e:
        logger.error("Failed to create dispatch: %s", e)
        return {"status": "error", "message": f"Dispatch failed: {str(e)}"}


# =============================================================================
# FASTAPI SERVER
# =============================================================================

try:
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel

    app = FastAPI(
        title="VoicePay Outbound Call Trigger",
        version="1.0.0",
        description="Trigger proactive outbound calls from VoicePay AI agent",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    class CallRequest(BaseModel):
        phone_number: str
        user_name: str = "User"
        purpose: str = "general_reminder"
        persona: str = "anisha"
        language: str = "en"
        facts: dict[str, Any] | None = None
        user_id: str | None = None
        force: bool = False

    class CampaignRequest(BaseModel):
        purpose: str = "scheme_reminder"
        persona: str = "anisha"
        max_calls: int = 10

    @app.post("/api/outbound/call")
    async def trigger_call(req: CallRequest):
        """Trigger a single outbound call."""
        result = await dispatch_outbound_call(
            phone_number=req.phone_number,
            user_name=req.user_name,
            purpose=req.purpose,
            persona=req.persona,
            language=req.language,
            facts=req.facts,
            user_id=req.user_id,
            force=req.force,
        )
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        return result

    @app.post("/api/outbound/campaign")
    async def trigger_campaign(req: CampaignRequest):
        """Trigger outbound calls for all eligible users (from memory DB)."""
        # This would query the DB for users with upcoming scheme deadlines
        # For now, return a placeholder
        return {
            "status": "campaign_initiated",
            "purpose": req.purpose,
            "max_calls": req.max_calls,
            "message": "Campaign trigger not yet connected to scheduler. Use /api/outbound/call for individual calls.",
        }

    @app.get("/api/outbound/status")
    async def get_status():
        """Get outbound calling system status."""
        return {
            "status": "active",
            "trunk_configured": bool(os.environ.get("SIP_OUTBOUND_TRUNK_ID")),
            "dnd_active": is_dnd_hours(),
            "current_time_ist": datetime.now(IST).strftime("%I:%M %p IST"),
            "calling_hours": "9:00 AM - 9:00 PM IST",
            "max_daily_attempts": MAX_DAILY_ATTEMPTS,
            "valid_purposes": VALID_PURPOSES,
        }

except ImportError:
    app = None
    logger.debug("FastAPI not installed — CLI mode only")


# =============================================================================
# CLI MODE
# =============================================================================

def cli_main():
    """CLI entrypoint for triggering calls."""
    import argparse

    parser = argparse.ArgumentParser(description="VoicePay Outbound Call Trigger")
    subparsers = parser.add_subparsers(dest="command")

    # call command
    call_parser = subparsers.add_parser("call", help="Trigger a single outbound call")
    call_parser.add_argument("--phone", required=True, help="Phone number (E.164 format)")
    call_parser.add_argument("--name", default="User", help="User's name")
    call_parser.add_argument("--purpose", default="general_reminder", choices=VALID_PURPOSES)
    call_parser.add_argument("--persona", default="anisha", choices=["anisha", "samar", "pooja"])
    call_parser.add_argument("--language", default="en", choices=["en", "hi"])
    call_parser.add_argument("--user-id", default=None, help="User ID from memory DB")
    call_parser.add_argument("--force", action="store_true", help="Override DND and attempt limits")

    # campaign command
    subparsers.add_parser("campaign", help="Trigger campaign calls")

    # status command
    subparsers.add_parser("status", help="Check outbound system status")

    args = parser.parse_args()

    if args.command == "call":
        result = asyncio.run(dispatch_outbound_call(
            phone_number=args.phone,
            user_name=args.name,
            purpose=args.purpose,
            persona=args.persona,
            language=args.language,
            user_id=args.user_id,
            force=args.force,
        ))
        print(json.dumps(result, indent=2))

    elif args.command == "status":
        print(json.dumps({
            "trunk_configured": bool(os.environ.get("SIP_OUTBOUND_TRUNK_ID")),
            "dnd_active": is_dnd_hours(),
            "current_time_ist": datetime.now(IST).strftime("%I:%M %p IST"),
            "valid_purposes": VALID_PURPOSES,
        }, indent=2))

    elif args.command == "campaign":
        print("Campaign mode not yet connected to scheduler.")
        print("Use: python trigger_call.py call --phone +91XXXXXXXXXX --name Name --purpose scheme_reminder")

    else:
        parser.print_help()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] in ("call", "campaign", "status"):
        cli_main()
    else:
        # Default: run FastAPI server
        try:
            import uvicorn
            print("Starting VoicePay Outbound Trigger API on http://localhost:8080")
            print("Docs: http://localhost:8080/docs")
            uvicorn.run("trigger_call:app", host="0.0.0.0", port=8080, reload=True)
        except ImportError:
            print("FastAPI/uvicorn not installed. Use CLI mode:")
            print("  python trigger_call.py call --phone +919876543210 --name Aman --purpose scheme_reminder")
            cli_main()
