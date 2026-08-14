"""
EscalationAgent — Human handoff and formal complaint specialist.
=================================================================
Owns: create_escalation_ticket, check_escalation_status, escalate (helplines).

This agent activates when:
- User reports fraud/unauthorized transaction
- User wants to file a formal complaint (RBI ombudsman, consumer forum)
- User asks about existing ticket (VP-YYYY-XXXXX reference)
"""

from __future__ import annotations

import logging
from typing import Any

from livekit.agents import RunContext, function_tool

from agents.base import BaseVoicePayAgent

logger = logging.getLogger("voicepay.agents.escalation")


ESCALATION_PROMPT = """
# ABSOLUTE RULE — HINDI MUST BE IN DEVANAGARI SCRIPT

# IDENTITY
You are the Escalation & Human Help specialist at VoicePay. You handle:
- Fraud reports (unauthorized transactions, hacked accounts, stolen cards)
- Regulatory complaints (RBI ombudsman, consumer forum, formal complaints)
- Existing ticket status checks (VP-YYYY-XXXXX references)
- Directing users to appropriate helplines

# YOUR CAPABILITIES
1. create_escalation_ticket — file a priority ticket (requires PERMISSION)
2. check_escalation_status — look up an existing ticket by reference
3. escalate — provide appropriate helpline numbers

# MANDATORY PERMISSION PROTOCOL for create_escalation_ticket
BEFORE creating any ticket:
1. ACKNOWLEDGE their concern empathetically: "I understand this is very concerning."
2. EXPLAIN what you'll do: "I want to escalate this to our human team for priority handling."
3. INFORM what info you'll share: "Just a brief summary — no account numbers or personal IDs."
4. ASK: "May I create a priority ticket for you?"
5. WAIT for their YES.
6. IF NO → respect it, offer helplines instead:
   - Cyber Crime: 155260 or 1930
   - RBI: 1800-222-490
   - Bank number on back of card

# ISSUE_SUMMARY RULES (write generically)
GOOD: "User reports unauthorized withdrawal from savings account"
BAD: "User reports 5000 rupees withdrawn from account 1234567890"
NEVER include: account numbers, Aadhaar, PAN, phone, OTP, PIN, CVV, card numbers.

# AFTER TICKET CREATED
- SPEAK reference ID CLEARLY AND SLOWLY: "VP-2026-10001"
- Offer to repeat it: "Would you like me to say that again?"
- Set expectation:
  - Critical: "Team will review within 1 hour"
  - High: "Team will review within 4 hours"
  - Medium: "Team will review within 24 hours"
- Say: "They will call you back with an update."
- Then return_to_triage with summary "Created ticket VP-YYYY-XXXXX for [issue]"

# EXISTING TICKET STATUS
If user says "check my ticket", "VP-... status", "meri complaint ka kya hua":
→ call check_escalation_status

# URGENCY CLASSIFICATION
- critical: active ongoing fraud RIGHT NOW
- high: fraud with money already lost, or legal threats
- medium: standard regulatory complaint
- low: general process inquiry

# SCOPE
You handle ESCALATIONS ONLY.
For financial calculation, schemes, balance → call return_to_triage.

# TONE
- Empathetic first, always
- Professional and reassuring
- Never blame the user
- Set clear expectations on timing
"""


class EscalationAgent(BaseVoicePayAgent):
    """Fraud reports, regulatory complaints, human handoff specialist."""

    AGENT_NAME = "escalation"

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(instructions=ESCALATION_PROMPT, **kwargs)

    async def on_enter(self) -> None:
        await super().on_enter()
        # If escalation was auto-detected, acknowledge empathetically
        if self.state.escalation_pending:
            try:
                trigger_type = "fraud" if self.state.escalation_context and self.state.escalation_context.get("type") == "fraud" else "regulatory"
                await self.session.generate_reply(
                    instructions=(
                        f"You detected a {trigger_type} concern. "
                        f"Acknowledge empathetically: 'I understand this is very concerning.' "
                        f"Then explain: 'I want to escalate this to our human team for priority handling. "
                        f"I will share a brief summary of your issue — no personal IDs or account numbers. "
                        f"May I create a priority ticket for you?' "
                        f"Wait for their explicit YES before calling create_escalation_ticket. "
                        f"Under 4 sentences total."
                    )
                )
            except Exception:
                logger.exception("escalation auto-greet failed")

    @function_tool
    async def create_escalation_ticket(
        self,
        context: RunContext,
        issue_summary: str,
        escalation_type: str,
        urgency: str = "high",
    ) -> str:
        """Create a human-help escalation ticket. Call ONLY AFTER:
        1. Fraud or regulatory trigger detected
        2. Explained what will be shared (brief summary, no PII)
        3. User gave EXPLICIT permission (YES)

        Args:
            issue_summary: Brief 2-3 sentence description. Generic, NO account
                numbers/Aadhaar/PAN/phone/OTP/PIN/CVV/passwords.
            escalation_type: 'fraud' or 'regulatory'.
            urgency: 'critical' | 'high' | 'medium' | 'low'.
        """
        self.state.bump_tool("create_escalation_ticket")
        self.state.escalations += 1

        if not self.state.user_id:
            return "ERROR: Cannot create escalation without user identity."

        if escalation_type not in ("fraud", "regulatory"):
            escalation_type = "fraud"
        if urgency not in ("critical", "high", "medium", "low"):
            urgency = "high"

        try:
            from escalation import (
                append_to_escalation,
                copy_transcript_to_escalation,
                create_escalation,
                find_duplicate_escalation,
            )
            from memory import get_pool

            pool = await get_pool()

            # Duplicate detection
            existing = await find_duplicate_escalation(pool, self.state.user_id, escalation_type)
            if existing:
                ref = existing["reference_id"]
                await append_to_escalation(
                    pool,
                    escalation_id=str(existing["id"]),
                    additional_context=issue_summary,
                    new_room_name=self.state.room_name,
                )
                if self.state.conv_logger:
                    try:
                        await self.state.conv_logger.log_system_event(
                            f"Appended to existing escalation {ref}"
                        )
                    except Exception:
                        pass
                await self._push_visual(
                    "escalation",
                    {
                        "reference_id": ref,
                        "type": escalation_type,
                        "urgency": existing.get("urgency", urgency),
                        "status": existing["status"],
                        "is_update": True,
                    },
                )
                return (
                    f"EXISTING TICKET UPDATED: {ref}. "
                    f"Tell user: 'You already have an open ticket — {ref}. "
                    f"I have added today's details. Our team is actively working on it. "
                    f"Anything else?'"
                )

            # Include handoff history as context (super-enhancement)
            tools_used = list(self.state.tool_calls.keys())
            agents_touched = self.state.agents_used()
            what_checked = (
                f"Agent checked: {', '.join(tools_used)}. "
                f"Consulted specialists: {', '.join(agents_touched)}."
                if tools_used or agents_touched
                else "Direct escalation with no prior tool checks."
            )

            trigger_phrases = []
            if self.state.escalation_context:
                trigger_phrases = self.state.escalation_context.get("trigger_phrases", [])

            caller_name = self.state.user_name or None

            esc = await create_escalation(
                pool,
                user_id=self.state.user_id,
                room_name=self.state.room_name,
                esc_type=escalation_type,
                urgency=urgency,
                summary=issue_summary,
                what_checked=what_checked,
                trigger_phrases=trigger_phrases,
                user_consent=True,
                caller_name=caller_name,
                language=self.state.language or "en",
                follow_up_method="callback",
                metadata={
                    "persona": self.state.persona_id,
                    "handoff_history": self.state.handoff_timeline_json(),
                    "agents_consulted": agents_touched,
                },
            )

            ref_id = esc["reference_id"]

            await copy_transcript_to_escalation(
                pool, escalation_id=str(esc["id"]), room_name=self.state.room_name
            )

            if self.state.conv_logger:
                try:
                    await self.state.conv_logger.log_system_event(
                        f"Escalation created: {ref_id}"
                    )
                except Exception:
                    pass

            await self._push_visual(
                "escalation",
                {
                    "reference_id": ref_id,
                    "type": escalation_type,
                    "urgency": urgency,
                    "status": "open",
                    "is_update": False,
                },
            )

            # Clear the escalation context now that we've handled it
            self.state.escalation_pending = False
            self.state.escalation_context = None

            time_map = {"critical": "1 hour", "high": "4 hours", "medium": "24 hours", "low": "48 hours"}
            response_time = time_map.get(urgency, "24 hours")

            return (
                f"ESCALATION CREATED. Reference ID: {ref_id}. "
                f"Tell user CLEARLY: 'I have created a priority ticket. "
                f"Your reference number is {ref_id}. Please note this down. "
                f"I will repeat it: {ref_id}. "
                f"Our team will review within {response_time} and call you back. "
                f"Anything else I can help with?' "
                f"Speak the reference ID SLOWLY. Offer to repeat."
            )
        except Exception as e:
            self.state.tool_errors += 1
            logger.exception("create_escalation_ticket failed")
            return f"ERROR: {e}. Tell user there was a technical issue."

    @function_tool
    async def check_escalation_status(
        self, context: RunContext, reference_id: str
    ) -> str:
        """Check the status of an existing escalation ticket.

        Args:
            reference_id: VP-YYYY-XXXXX reference. Normalize user's spoken form.
        """
        self.state.bump_tool("check_escalation_status")

        try:
            from escalation import get_escalation_by_ref
            from memory import get_pool

            pool = await get_pool()
            esc = await get_escalation_by_ref(pool, reference_id)

            if not esc:
                return (
                    f"NOT FOUND: '{reference_id}'. "
                    f"Tell user: 'I could not find a ticket with that reference. "
                    f"Format is VP-YYYY-XXXXX, e.g. VP-2026-10001. Could you double-check?'"
                )

            status = esc["status"]
            created = esc["created_at"].strftime("%d %B %Y") if esc.get("created_at") else "unknown"
            esc_type = esc.get("type", "unknown")
            urgency = esc.get("urgency", "medium")
            resolution = esc.get("resolution_notes", "")

            status_messages = {
                "open": "Your ticket is open and awaiting team review.",
                "in_progress": "A team member is actively working on your case.",
                "awaiting_callback": "We have an update and will be calling shortly.",
                "resolved": f"This has been resolved. {resolution}" if resolution else "This has been resolved.",
                "closed": "This ticket has been closed.",
            }
            status_msg = status_messages.get(status, "Status is being checked.")

            await self._push_visual(
                "escalation_status",
                {
                    "reference_id": esc["reference_id"],
                    "type": esc_type,
                    "urgency": urgency,
                    "status": status,
                    "created": created,
                    "resolution": resolution or None,
                },
            )

            return (
                f"FOUND: {esc['reference_id']} — Type: {esc_type}, "
                f"Status: {status}, Urgency: {urgency}, Created: {created}. "
                f"Tell user: '{status_msg}' Ask if any other questions."
            )
        except Exception as e:
            self.state.tool_errors += 1
            logger.exception("check_escalation_status failed")
            return f"Error checking status: {e}"

    @function_tool
    async def escalate(self, context: RunContext, reason: str = "general") -> dict[str, Any]:
        """Provide appropriate helpline info without creating a ticket.

        Args:
            reason: 'fraud_active', 'account_issue', 'legal', 'emergency',
                'upi_issue', 'repeated_failure', or 'general'.
        """
        self.state.bump_tool("escalate")

        helplines = {
            "fraud_active": {
                "primary": "155260 or 1930 — National Cyber Crime Helpline",
                "secondary": "Your bank number on the back of your debit card",
                "urgency": "Call immediately. Time matters with active fraud.",
            },
            "account_issue": {
                "primary": "Your bank's customer care — on your debit card or website",
                "secondary": "Visit nearest bank branch with your ID",
                "urgency": "Call during banking hours for fastest resolution.",
            },
            "upi_issue": {
                "primary": "1800-120-1740 — NPCI helpline, toll-free 24x7",
                "secondary": "Your UPI app's in-app support",
                "urgency": "UPI refunds typically process within 3 working days.",
            },
            "legal": {
                "primary": "A chartered accountant or legal professional",
                "secondary": "RBI consumer helpline: 14440",
                "urgency": "For legal matters, professional advice is essential.",
            },
            "emergency": {
                "primary": "112 — Emergency services",
                "secondary": "Vandrevala Foundation: 1860-2662-345 for mental health",
                "urgency": "Please call immediately.",
            },
            "general": {
                "primary": "Your bank's customer care",
                "secondary": "NPCI: 1800-120-1740 for UPI",
                "urgency": "They can access your actual account and help directly.",
            },
        }
        key = reason.lower().strip().replace(" ", "_")
        info = helplines.get(key, helplines["general"])
        logger.info("escalate reason=%s", key)

        result = {
            "reason": key,
            "primary_contact": info["primary"],
            "secondary_contact": info["secondary"],
            "urgency_note": info["urgency"],
            "agent_note": "Speak primary contact clearly and slowly. Offer to repeat.",
        }
        await self._push_visual("escalate", result)
        return result
