"""
SecurityAgent — Credential protection, scam education, privacy specialist.
===========================================================================
Owns: credential-detection response, scam warning cards, forget_me (data
deletion), call_me_on_phone (SIP transfer).

This agent activates when:
- User shares credential-like patterns (OTP/PIN/CVV + digits)
- User asks "forget me" / "delete my data"
- User asks for phone transfer
- Any privacy/security concern
"""

from __future__ import annotations

import json as _json
import logging
import os
import time
from typing import Any

from livekit.agents import RunContext, function_tool

from agents.base import BaseVoicePayAgent

logger = logging.getLogger("voicepay.agents.security")


SECURITY_PROMPT = """
# ABSOLUTE RULE — HINDI MUST BE IN DEVANAGARI SCRIPT

# IDENTITY
You are the Security & Privacy specialist at VoicePay. Your job is CRITICAL:
you protect users from fraud and honor their privacy rights.

# YOUR CAPABILITIES
1. show_visual_card — display scam warning cards
2. call_me_on_phone — transfer conversation to user's phone via SIP
3. forget_me — permanently delete all user data

# WHEN YOU'RE ACTIVATED
Triage routes to you when:
- Credential pattern detected in user's speech (OTP/PIN/CVV + digits)
- User says "forget me", "delete my data", "mera data delete karo"
- User asks "call me on my phone", "phone pe baat karo"

# CREDENTIAL EXPOSURE RESPONSE (MOST COMMON)
If the user just shared or was about to share credentials:
1. IMMEDIATELY stop them: "Rukiye — please stop right there."
2. Say clearly: "Never share your OTP, PIN, password, or card number with anyone."
3. Add: "Not even someone who sounds like your bank. Main kabhi nahi puchungi."
4. Show a visual card with scam education tips
5. Reassure: "You are safe. Nothing was recorded."
6. Ask: "What can I help you with instead?"
7. When done, return_to_triage with summary "Warned user about credential sharing"

# SCAM EDUCATION TOPICS (proactively teach)
- KYC-expiry calls → "Banks never call to say KYC expired. Visit branch."
- Account-block SMS → "No bank blocks accounts by SMS. It's a scam."
- Collect requests → "You NEVER need a PIN to receive money. PIN = sending."
- AnyDesk/TeamViewer → "No bank asks you to install screen-sharing apps."
- Lottery/refund → "You can't win a lottery you didn't enter."
- QR scanning → "Scanning a QR only SENDS money, never receives it."
- Fake helplines → "Real: NPCI 1800-120-1740, CyberCrime 155260/1930"

# FORGET_ME BEHAVIOR
When user asks to delete their data:
1. Confirm once: "You want me to permanently delete everything I know about you?"
2. If confirmed → call forget_me tool
3. After deletion, tell them warmly it's done
4. Then return_to_triage

# CALL_ME_ON_PHONE BEHAVIOR
When user wants to continue on phone:
1. Ask for the number: "Which number should I call?"
2. Confirm: "So I'll call you at XXXX. Correct?"
3. Call call_me_on_phone with the number
4. Set expectation: "You'll get a call in 10-15 seconds. Pick up when it rings."

# TONE
- Firm but calm on credentials — don't scold
- Empathetic on privacy requests
- Clear on what happens next
- Never make user feel stupid for asking

# SCOPE
You ONLY handle security and privacy.
For financial questions → call return_to_triage.
"""


class SecurityAgent(BaseVoicePayAgent):
    """Credential protection, scam education, privacy specialist."""

    AGENT_NAME = "security"

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(instructions=SECURITY_PROMPT, **kwargs)

    async def on_enter(self) -> None:
        await super().on_enter()
        # Auto-respond if we were routed due to credential detection
        if self.state.credential_detected:
            self.state.security_blocks += 1
            try:
                await self.session.generate_reply(
                    instructions=(
                        "The user just tried to share credential-like information "
                        "(OTP/PIN/CVV/card digits). IMMEDIATELY stop them warmly: "
                        "'Rukiye — please stop right there. Never share your OTP, PIN, or card number with anyone. "
                        "Not even someone who sounds like your bank. I will never ask for these.' "
                        "Then show a scam warning card and ask how you can help instead. "
                        "Under 4 sentences total."
                    )
                )
            except Exception:
                logger.exception("credential auto-response failed")
            # Clear the flag so we don't retrigger
            self.state.credential_detected = False

    @function_tool
    async def forget_me(self, context: RunContext) -> str:
        """Permanently delete all stored data about the current caller.

        Call ONLY when user explicitly asks: "forget me", "delete my data",
        "mera data delete karo", "I don't want you to remember me".

        This permanently removes: name, all facts, all conversation summaries.
        Cannot be undone.
        """
        self.state.bump_tool("forget_me")

        if not self.state.user_id:
            return "No user identity available. Tell user you cannot delete right now."

        try:
            from memory import forget_user

            deleted = await forget_user(self.state.user_id)
            if deleted:
                # Clear in-memory state
                self.state.user_memory = {}
                self.state.consent_given = False
                self.state.user_name = ""
                logger.info("forget_me: DELETED user=%s", self.state.user_id)
                return (
                    "SUCCESS: All data permanently deleted. "
                    "Tell user warmly that their data is gone. "
                    "Then ask if there's anything else."
                )
            return "No stored data found. Tell user there's nothing to delete."
        except Exception as e:
            logger.exception("forget_me failed")
            return f"ERROR: {e}. Tell user there was a problem."

    @function_tool
    async def call_me_on_phone(
        self, context: RunContext, phone_number: str, reason: str = "continue conversation"
    ) -> str:
        """Transfer this conversation to the user's phone via outbound SIP call.

        Call when user says: "Call me", "phone pe baat karo", "transfer to phone".

        Args:
            phone_number: Indian format, 10 digits. Ask user for number first.
            reason: Why transfer. Example: "User requested phone call"
        """
        self.state.bump_tool("call_me_on_phone")

        if self.state.conv_logger:
            try:
                await self.state.conv_logger.log_tool_call(
                    "call_me_on_phone", {"phone": "XXXXXXXX", "reason": reason}
                )
            except Exception:
                pass

        sip_uri = os.environ.get("LINPHONE_SIP_URI", "sip:aman021998@sip.linphone.org")
        sip_trunk_id = os.environ.get("SIP_OUTBOUND_TRUNK_ID", "")

        if not sip_trunk_id:
            return (
                "TRANSFER FAILED: SIP trunk not configured. "
                "Tell user: 'I'm sorry, phone transfer is not available right now. "
                "Is there anything else I can help you with?'"
            )

        try:
            from livekit import api as lk_api

            room_name = f"transfer_{self.state.room_name}_{int(time.time())}"

            lk_client = lk_api.LiveKitAPI()
            await lk_client.agent_dispatch.create_dispatch(
                lk_api.CreateAgentDispatchRequest(
                    agent_name="voicepay-outbound",
                    room=room_name,
                    metadata=_json.dumps(
                        {
                            "phone_number": phone_number,
                            "sip_uri": sip_uri,
                            "user_name": self.state.user_name or "User",
                            "purpose": "transfer",
                            "persona": self.state.persona_id,
                            "language": self.state.language,
                            "user_id": self.state.user_id,
                            "facts": {},
                        }
                    ),
                )
            )
            await lk_client.aclose()

            if self.state.conv_logger:
                try:
                    await self.state.conv_logger.log_system_event(
                        f"Outbound call dispatched to {phone_number[-4:]}"
                    )
                except Exception:
                    pass

            await self._push_visual(
                "escalation",
                {
                    "reference_id": f"CALL-{phone_number[-4:]}",
                    "type": "transfer",
                    "urgency": "medium",
                    "status": "open",
                    "is_update": False,
                },
            )

            return (
                "CALL DISPATCHED. Tell user: 'I'm calling your phone now. "
                "Please pick up when it rings. I'll continue our conversation there.' "
                "The user should hear their phone ring within 10-15 seconds."
            )
        except Exception as e:
            logger.warning("call_me_on_phone failed: %s", e)
            return (
                f"TRANSFER FAILED: {str(e)[:100]}. "
                "Tell user: 'I could not connect the call. Continue here instead?'"
            )
