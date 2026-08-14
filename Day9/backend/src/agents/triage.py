"""
TriageAgent — The dispatcher and front-door for all VoicePay calls.
===================================================================
Responsibilities:
  - Greet the user (personalized for returning users)
  - Classify user intent
  - Route to the correct specialist via route_to_* tools
  - Handle general chitchat within banking scope
  - Recall user memory
  - Act as the "home base" when specialists hand back
"""

from __future__ import annotations

import logging
from typing import Any

from livekit.agents import Agent, RunContext, function_tool

from agents.base import BaseVoicePayAgent
from state import VoicePayState

logger = logging.getLogger("voicepay.agents.triage")


def _build_triage_prompt(persona: dict[str, Any]) -> str:
    """Build the triage-specific system prompt."""
    name = persona.get("name_display", "Anisha")
    personality = persona.get("personality", "warm, patient, nurturing")

    return f"""
# ABSOLUTE RULE — HINDI MUST BE IN DEVANAGARI SCRIPT — NO EXCEPTIONS
# ALWAYS write Hindi in DEVANAGARI: नमस्ते, आपका बैलेंस, सोने का भाव
# NEVER write romanized Hindi: "namaste", "aapka balance"
# VIOLATION = BROKEN TTS = FAILED CONVERSATION

# IDENTITY
You are {name} from VoicePay — a {personality} AI voice banking assistant for Bharat.
You are the TRIAGE agent — the user's first point of contact. Your job is to:
1. Greet the user warmly
2. Understand what they need
3. Route them to the right specialist OR answer simple questions yourself

# YOUR ROLE AS DISPATCHER
You have 5 specialist teams. Route the user to the RIGHT one:

## CALCULATOR SPECIALIST (route_to_calculator)
Route when user mentions: EMI, loan amount, tenure, interest rate, "kitna milega",
FD comparison, "which bank gives best rate", loan eligibility, financial comparison.

## SCHEMES SPECIALIST (route_to_schemes)
Route when user mentions: sarkari yojana, government scheme, eligibility check,
"documents chahiye", gold rate, silver price, RBI rate, "sone ka bhav".

## ACCOUNTS SPECIALIST (route_to_accounts)
Route when user mentions: balance, transactions, "kya kharcha hua", UPI guide,
"how to send money", "save my preferences", account information.

## SECURITY SPECIALIST (route_to_security)
Route when: credential pattern detected (OTP/PIN/CVV mentioned with digits),
user says "forget me" / "delete my data", user asks "call me on phone".

## ESCALATION SPECIALIST (route_to_escalation)
Route when: fraud reported ("unauthorized transaction", "account hacked"),
regulatory complaint ("RBI ombudsman", "consumer forum", "formal complaint"),
user asks about existing ticket ("VP-2026-XXXXX status").

# WHAT YOU HANDLE YOURSELF (DO NOT ROUTE)
- Simple greetings and small talk within banking scope
- "Who are you?" / "What can you do?" questions
- Off-topic deflection (recipes, weather, etc → politely refuse)
- Recalling user memory (recall_user_info)
- General banking knowledge questions that don't need a tool

# PROACTIVE SUGGESTIONS (when returning from a specialist)
Check the conversation so far. If the user just:
- Got an EMI calculation → suggest "Want me to check documents needed for this loan?"
- Checked scheme eligibility → suggest "Shall I also check the document list?"
- Asked about gold rates → suggest "Want to compare FD rates too?"
Only suggest ONCE. Don't repeat if they decline.

# SCOPE BOUNDARY
You are ONLY for banking and financial services. If user asks about recipes,
weather, movies, coding, health → warmly refuse and redirect to finance.

# LANGUAGE
- Start in English for first greeting
- Mirror user's language: Hindi → Devanagari, Hinglish → mix, English → English
- Once Hindi is established, STAY in Hindi

# STYLE — Voice Optimized
- Max 20 words per sentence
- Max 3-4 sentences per response
- Start with acknowledgment: "Sure.", "Bilkul.", "Achha."
- NO markdown, NO bullets, NO asterisks
- Natural spoken Indian English with Hinglish code-mixing
- End with ONE forward question or offer

# SECURITY (always active)
- NEVER ask for OTP, PIN, CVV, password, card number, Aadhaar
- If user shares credentials → route to Security specialist immediately
- NEVER claim to be a bank or execute transactions
- NEVER guarantee loan approval or scheme eligibility

# AFTER RETURNING FROM SPECIALIST
When a specialist hands back to you, the user may want:
- Something from a DIFFERENT specialist → route there
- To end the call → say goodbye warmly
- More from the SAME specialist → route back

Be natural: "I'm back. What else can I help you with?"
"""


class TriageAgent(BaseVoicePayAgent):
    """
    Front-door dispatcher for VoicePay.
    Routes to 5 specialists based on user intent.
    """

    AGENT_NAME = "triage"

    def __init__(
        self,
        persona: dict[str, Any] | None = None,
        user_memory: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> None:
        self._persona = persona or {"name_display": "Anisha", "personality": "warm, patient"}
        self._user_memory = user_memory
        super().__init__(instructions=_build_triage_prompt(self._persona), **kwargs)

    async def on_enter(self) -> None:
        """Greet the user — personalized for returning users."""
        await super().on_enter()

        persona_name = self._persona.get("name_display", "Anisha")
        memory = self._user_memory or self.state.user_memory

        if memory and memory.get("name"):
            # RETURNING USER
            user_name = memory["name"]
            total_calls = memory.get("total_calls", 1)
            last_conv = memory.get("last_conversation")

            if last_conv and last_conv.get("summary"):
                greeting_instruction = (
                    f"You are greeting a RETURNING user named {user_name}. "
                    f"This is their call number {total_calls}. "
                    f"Last time: {last_conv['summary']}. "
                    f"Greet warmly by name, briefly reference last topic, "
                    f"ask how to help. Under 3 sentences. Be {persona_name}."
                )
            else:
                greeting_instruction = (
                    f"You are greeting a RETURNING user named {user_name}. "
                    f"Call number {total_calls}. Greet by name, ask how to help. "
                    f"Under 2 sentences. Be {persona_name}."
                )
            logger.info("greeting RETURNING user=%s calls=%d", user_name, total_calls)
            try:
                await self.session.generate_reply(instructions=greeting_instruction)
            except Exception:
                await self.session.say(f"Welcome back, {user_name}! How can I help?")
        else:
            # NEW USER or returning from specialist
            if self.state.handoff_count > 0:
                # Coming back from a specialist — brief re-entry
                try:
                    last = self.state.handoff_history[-1]
                    await self.session.generate_reply(
                        instructions=(
                            f"The {last.from_agent} specialist just finished helping the user. "
                            f"They accomplished: '{last.context_summary or 'their query'}'. "
                            f"Briefly acknowledge and ask if there's anything else. "
                            f"Under 2 sentences. Example: 'Done! What else can I help with?'"
                        )
                    )
                except Exception:
                    await self.session.say("I'm back. What else can I help you with?")
            else:
                # First greeting
                greeting = self._persona.get(
                    "greeting",
                    f"Hello! I'm {persona_name}, your VoicePay assistant. How can I help you today?",
                )
                logger.info("greeting NEW user with persona=%s", persona_name)
                try:
                    await self.session.generate_reply(
                        instructions=f"Say exactly: {greeting}"
                    )
                except Exception:
                    await self.session.say(greeting)

    # ------------------------------------------------------------------
    # Memory tool — triage owns this since it runs on first contact
    # ------------------------------------------------------------------
    @function_tool
    async def recall_user_info(self, context: RunContext) -> dict[str, Any]:
        """Look up what we know about the current caller from previous conversations.

        Call this when:
        - You want to check if this is a returning user
        - User says their name and you want to check memory
        - Conversation references something from a previous call
        """
        self.state.bump_tool("recall_user_info")
        if self.state.user_memory:
            return {"found": True, "already_loaded": True, **self.state.user_memory}

        if not self.state.user_id:
            return {"found": False, "reason": "No user identity available"}

        try:
            from memory import lookup_user

            user_data = await lookup_user(self.state.user_id)
            if user_data:
                self.state.user_memory = user_data
                self.state.user_name = user_data.get("name", "")
                return {"found": True, **user_data}
            return {"found": False, "reason": "New user — no previous data"}
        except Exception as e:
            logger.exception("recall_user_info failed")
            return {"found": False, "error": str(e)}

    # ------------------------------------------------------------------
    # Routing tools — one per specialist
    # ------------------------------------------------------------------
    @function_tool
    async def route_to_calculator(
        self, context: RunContext, reason: str = "User wants financial calculation"
    ):
        """Route the user to the Financial Calculator specialist.

        Call when user asks about: EMI calculation, loan eligibility,
        FD rate comparison, financial reasoning, "kitna milega", or any
        numerical financial computation.

        Args:
            reason: Brief reason for routing. Example: "User wants home loan EMI for 10 lakh"
        """
        from agents.calculator import CalculatorAgent

        self.state.record_handoff("triage", "calculator", reason)
        logger.info("ROUTING triage → calculator: %s", reason)
        return CalculatorAgent(chat_ctx=self.chat_ctx.copy(exclude_instructions=True))

    @function_tool
    async def route_to_schemes(
        self, context: RunContext, reason: str = "User asking about schemes/rates"
    ):
        """Route to the Government Schemes & Rates specialist.

        Call when user asks about: government yojana, scheme eligibility,
        document checklist, gold/silver prices, RBI rates, "sone ka bhav",
        or any scheme-related information.

        Args:
            reason: Brief reason for routing.
        """
        from agents.schemes import SchemeAgent

        self.state.record_handoff("triage", "schemes", reason)
        logger.info("ROUTING triage → schemes: %s", reason)
        return SchemeAgent(chat_ctx=self.chat_ctx.copy(exclude_instructions=True))

    @function_tool
    async def route_to_accounts(
        self, context: RunContext, reason: str = "User asking about account/UPI"
    ):
        """Route to the Accounts & UPI specialist.

        Call when user asks about: balance check, transaction history,
        UPI steps/guide, saving preferences, account information.

        Args:
            reason: Brief reason for routing.
        """
        from agents.accounts import AccountsAgent

        self.state.record_handoff("triage", "accounts", reason)
        logger.info("ROUTING triage → accounts: %s", reason)
        return AccountsAgent(chat_ctx=self.chat_ctx.copy(exclude_instructions=True))

    @function_tool
    async def route_to_security(
        self, context: RunContext, reason: str = "Security concern detected"
    ):
        """Route to the Security & Privacy specialist.

        Call when: credential pattern detected (user shared OTP/PIN/CVV digits),
        user asks to delete their data ("forget me"), user wants phone transfer,
        or any privacy/security concern.

        Args:
            reason: Brief reason for routing.
        """
        from agents.security_agent import SecurityAgent

        self.state.record_handoff("triage", "security", reason)
        logger.info("ROUTING triage → security: %s", reason)
        return SecurityAgent(chat_ctx=self.chat_ctx.copy(exclude_instructions=True))

    @function_tool
    async def route_to_escalation(
        self, context: RunContext, reason: str = "Escalation trigger detected"
    ):
        """Route to the Escalation & Human Help specialist.

        Call when: user reports fraud/unauthorized transaction, user wants to
        file a formal complaint, user mentions RBI ombudsman or consumer forum,
        or user asks about an existing escalation ticket (VP-XXXX reference).

        Args:
            reason: Brief reason for routing.
        """
        from agents.escalation_agent import EscalationAgent

        self.state.record_handoff("triage", "escalation", reason)
        logger.info("ROUTING triage → escalation: %s", reason)
        return EscalationAgent(chat_ctx=self.chat_ctx.copy(exclude_instructions=True))
