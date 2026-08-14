"""
BaseVoicePayAgent — Shared behavior for all VoicePay specialists.
=================================================================
Every specialist inherits from this class. It provides:
  - Canvas push (visual cards via LiveKit data channel)
  - Handoff event emission (frontend notification)
  - return_to_triage tool (every specialist can hand back)
  - State accessor property
  - Common utility methods
"""

from __future__ import annotations

import asyncio
import json as _json
import logging
from datetime import datetime
from typing import Any

from livekit.agents import Agent, RunContext, function_tool

from state import VoicePayState

logger = logging.getLogger("voicepay.agents")


class BaseVoicePayAgent(Agent):
    """
    Abstract base for all VoicePay specialist agents.
    Subclasses MUST override AGENT_NAME and provide their own instructions.
    """

    AGENT_NAME: str = "base"  # Override in every subclass

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)

    # ------------------------------------------------------------------
    # State accessor
    # ------------------------------------------------------------------
    @property
    def state(self) -> VoicePayState:
        """Typed access to session-wide shared state."""
        return self.session.userdata

    # ------------------------------------------------------------------
    # Visual Canvas — push structured data to frontend
    # ------------------------------------------------------------------
    async def _push_visual(self, tool_name: str, data: dict[str, Any]) -> None:
        """Push tool result to frontend canvas via LiveKit data channel."""
        room = self.state.room
        if not room or not room.local_participant:
            logger.debug("_push_visual: no room/participant — skipping")
            return
        try:
            payload = _json.dumps(
                {
                    "type": "canvas",
                    "tool": tool_name,
                    "data": data,
                    "timestamp": datetime.now().isoformat(),
                    "agent": self.AGENT_NAME,
                }
            )
            await room.local_participant.publish_data(
                payload=payload.encode("utf-8"),
                topic="canvas",
                reliable=True,
            )
            logger.info("canvas pushed: tool=%s agent=%s", tool_name, self.AGENT_NAME)
        except Exception:
            logger.debug("_push_visual failed — non-critical, continuing")

    # ------------------------------------------------------------------
    # Handoff event emission — notify frontend of agent switch
    # ------------------------------------------------------------------
    async def _emit_handoff_event(self) -> None:
        """Publish a handoff notification over the data channel."""
        room = self.state.room
        if not room or not room.local_participant:
            return
        history = self.state.handoff_history
        last = history[-1] if history else None
        try:
            payload = _json.dumps(
                {
                    "type": "voicepay.handoff",
                    "from_agent": last.from_agent if last else "none",
                    "to_agent": self.AGENT_NAME,
                    "reason": last.reason if last else "session_start",
                    "timestamp": datetime.utcnow().isoformat(),
                    "handoff_count": self.state.handoff_count,
                }
            )
            await room.local_participant.publish_data(
                payload=payload.encode("utf-8"),
                topic="voicepay.handoff",
                reliable=True,
            )
        except Exception:
            logger.debug("_emit_handoff_event failed — non-critical")

    # ------------------------------------------------------------------
    # Lifecycle — on_enter fires every time this agent becomes active
    # ------------------------------------------------------------------
    async def on_enter(self) -> None:
        """
        Default on_enter: emit handoff event + persist to DB.
        Subclasses should call super().on_enter() then do their greeting.
        """
        # Emit frontend notification
        await self._emit_handoff_event()

        # Persist handoff to DB (fire-and-forget)
        from handoff import persist_handoff

        asyncio.ensure_future(persist_handoff(self.state, self.AGENT_NAME))

    # ------------------------------------------------------------------
    # show_visual_card — generic visual card push
    # ------------------------------------------------------------------
    @function_tool
    async def show_visual_card(
        self,
        context: RunContext,
        card_type: str,
        title: str,
        content: str,
    ) -> str:
        """Display a visual card on the user's screen.

        Call this WHENEVER you compute or explain something visual — numbers,
        comparisons, breakdowns, lists, rates, prices, EMI — ANYTHING the user
        would benefit from seeing on screen.

        Args:
            card_type: One of 'balance', 'emi', 'gold_prices', 'rbi_rates',
                'fd_comparison', 'loan_eligibility', 'scheme_eligibility',
                'documents', 'table', 'steps', 'scheme', 'info', 'agent_handoff'.
            title: Short title for the card (e.g. "Home Loan EMI").
            content: Full text content to display. Include numbers and breakdowns.
        """
        self.state.bump_tool("show_visual_card")
        await self._push_visual(card_type, {"title": title, "result_text": content[:800]})
        return (
            f"CARD SHOWN: '{title}' is now visible on the user's screen. "
            "Briefly tell them 'I've shown it on your screen' and continue."
        )

    # ------------------------------------------------------------------
    # return_to_triage — every specialist can hand back control
    # ------------------------------------------------------------------
    @function_tool
    async def return_to_triage(
        self,
        context: RunContext,
        summary: str = "",
    ):
        """Return control to the main triage/dispatcher agent.

        Call this when you have finished helping the user with your specialty
        and they want to ask about something else, OR when their question is
        outside your domain.

        Args:
            summary: Brief 1-sentence summary of what was accomplished.
                Example: "Calculated EMI of 8,500/month for 5L home loan at 8.5%"
        """
        from agents.triage import TriageAgent

        self.state.record_handoff(
            from_agent=self.AGENT_NAME,
            to_agent="triage",
            reason="specialist_complete",
            summary=summary,
        )
        return TriageAgent(chat_ctx=self.chat_ctx.copy(exclude_instructions=True))
