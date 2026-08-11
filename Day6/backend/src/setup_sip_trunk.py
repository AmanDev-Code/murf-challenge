"""
VoicePay — Outbound SIP Trunk Setup (One-time)
Creates a LiveKit outbound SIP trunk pointing to Twilio.
Run once, then copy the trunk ID to .env.local.

Usage:
    python src/setup_sip_trunk.py
"""

from __future__ import annotations

import asyncio
import os
import sys

from dotenv import load_dotenv

load_dotenv(".env.local")


async def main():
    from livekit import api
    from livekit.protocol.sip import CreateSIPOutboundTrunkRequest, SIPOutboundTrunkInfo

    # Validate env vars
    required = [
        "LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET",
        "TWILIO_SIP_USERNAME", "TWILIO_SIP_PASSWORD", "TWILIO_PHONE_NUMBER",
    ]
    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        print(f"ERROR: Missing env vars: {', '.join(missing)}")
        print("Add them to .env.local and try again.")
        sys.exit(1)

    # Twilio termination URI: {AccountSID}.pstn.twilio.com
    account_sid = os.environ.get("TWILIO_ACCOUNT_SID", "")
    termination_uri = f"{account_sid}.pstn.twilio.com" if account_sid else "pstn.twilio.com"

    print(f"Creating LiveKit outbound SIP trunk...")
    print(f"  Termination URI: {termination_uri}")
    print(f"  Caller ID: {os.environ['TWILIO_PHONE_NUMBER']}")
    print(f"  Auth user: {os.environ['TWILIO_SIP_USERNAME']}")
    print()

    lkapi = api.LiveKitAPI()

    trunk = SIPOutboundTrunkInfo(
        name="VoicePay Twilio Outbound",
        address=termination_uri,
        numbers=[os.environ["TWILIO_PHONE_NUMBER"]],
        auth_username=os.environ["TWILIO_SIP_USERNAME"],
        auth_password=os.environ["TWILIO_SIP_PASSWORD"],
    )

    try:
        resp = await lkapi.sip.create_sip_outbound_trunk(
            CreateSIPOutboundTrunkRequest(trunk=trunk)
        )
        trunk_id = resp.sip_trunk_id
        print("=" * 60)
        print(f"SUCCESS! Outbound trunk created.")
        print(f"")
        print(f"  SIP_OUTBOUND_TRUNK_ID={trunk_id}")
        print(f"")
        print(f"Add this line to your .env.local file.")
        print("=" * 60)
    except Exception as e:
        print(f"ERROR creating trunk: {e}")
        sys.exit(1)
    finally:
        await lkapi.aclose()


if __name__ == "__main__":
    asyncio.run(main())
