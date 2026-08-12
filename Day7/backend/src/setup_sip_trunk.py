"""
VoicePay — Outbound SIP Trunk Setup for Linphone
Creates a LiveKit outbound SIP trunk pointing to sip.linphone.org.
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
    required = ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"]
    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        print(f"ERROR: Missing env vars: {', '.join(missing)}")
        sys.exit(1)

    # Linphone SIP server — direct SIP calling, no trunk provider needed
    sip_address = os.environ.get("LINPHONE_SIP_DOMAIN", "sip.linphone.org")
    sip_username = os.environ.get("LINPHONE_SIP_USERNAME", "aman021998")
    sip_password = os.environ.get("LINPHONE_SIP_PASSWORD", "Aman@2802")
    caller_number = os.environ.get("TWILIO_PHONE_NUMBER", "+17372508034")

    print(f"Creating LiveKit outbound SIP trunk (Linphone)...")
    print(f"  SIP Server: {sip_address}")
    print(f"  Username: {sip_username}")
    print(f"  Caller ID: {caller_number}")
    print()

    lkapi = api.LiveKitAPI()

    trunk = SIPOutboundTrunkInfo(
        name="VoicePay Linphone Outbound",
        address=sip_address,
        numbers=[caller_number],
        auth_username=sip_username,
        auth_password=sip_password,
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
        print(f"")
        print(f"To call Linphone, use SIP URI: sip:aman021998@sip.linphone.org")
        print("=" * 60)
    except Exception as e:
        print(f"ERROR creating trunk: {e}")
        sys.exit(1)
    finally:
        await lkapi.aclose()


if __name__ == "__main__":
    asyncio.run(main())
