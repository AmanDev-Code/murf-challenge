"""
VoicePay Multi-Agent Shared State
=================================
The VoicePayState dataclass lives on session.userdata and persists across
all agent handoffs within a single call. Every specialist reads and writes
to the same instance — no serialization boundary.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class HandoffBreadcrumb:
    """One hop in the agent handoff chain."""

    from_agent: str
    to_agent: str
    reason: str
    timestamp: datetime = field(default_factory=datetime.utcnow)
    context_summary: str = ""  # 1-line what was accomplished before handoff


@dataclass
class VoicePayState:
    """Session-wide shared state, lives on session.userdata."""

    # --- Customer Identity ---
    user_id: str = ""
    user_name: str = ""
    verified: bool = False
    consent_given: bool = False
    user_memory: dict[str, Any] = field(default_factory=dict)

    # --- Call Context ---
    room_name: str = ""
    language: str = "english"  # english | hindi | hinglish
    persona_id: str = "anisha"
    channel: str = "browser"  # browser | sip

    # --- Handoff Tracking ---
    current_agent: str = "triage"
    handoff_history: list[HandoffBreadcrumb] = field(default_factory=list)
    handoff_count: int = 0

    # --- Financial Context (persists across specialists) ---
    last_emi_result: dict[str, Any] | None = None
    last_eligibility_result: dict[str, Any] | None = None
    last_scheme_result: dict[str, Any] | None = None
    computed_values: dict[str, Any] = field(default_factory=dict)

    # --- Security Flags ---
    credential_detected: bool = False
    escalation_pending: bool = False
    escalation_context: dict[str, Any] | None = None
    security_blocks: int = 0

    # --- Conversation Logger (not serialized — runtime only) ---
    conv_logger: Any = None

    # --- Room reference (for data channel publishing) ---
    room: Any = None

    # --- Stats (for analytics at session end) ---
    started_at: float = 0.0
    tool_calls: dict[str, int] = field(default_factory=dict)
    tool_errors: int = 0
    escalations: int = 0
    user_turns: int = 0
    agent_turns: int = 0

    # --- Latency tracking ---
    latencies: list[Any] = field(default_factory=list)
    current_latency: Any = None

    def record_handoff(
        self,
        from_agent: str,
        to_agent: str,
        reason: str,
        summary: str = "",
    ) -> None:
        """Record a handoff event in the session state."""
        self.handoff_history.append(
            HandoffBreadcrumb(
                from_agent=from_agent,
                to_agent=to_agent,
                reason=reason,
                context_summary=summary,
            )
        )
        self.handoff_count += 1
        self.current_agent = to_agent

    def bump_tool(self, name: str) -> None:
        """Increment tool call counter."""
        self.tool_calls[name] = self.tool_calls.get(name, 0) + 1

    def agents_used(self) -> list[str]:
        """Deduplicated list of agents activated this session."""
        seen: list[str] = ["triage"]  # always starts with triage
        for h in self.handoff_history:
            if h.to_agent not in seen:
                seen.append(h.to_agent)
        return seen

    def primary_agent(self) -> str:
        """Agent that handled the most tool calls (heuristic)."""
        if not self.handoff_history:
            return "triage"
        # Count time per agent (by handoff index)
        agent_counts: dict[str, int] = {}
        for h in self.handoff_history:
            agent_counts[h.to_agent] = agent_counts.get(h.to_agent, 0) + 1
        return max(agent_counts, key=lambda k: agent_counts[k])

    def handoff_timeline_json(self) -> list[dict[str, Any]]:
        """Serializable timeline for DB storage."""
        return [
            {
                "from": h.from_agent,
                "to": h.to_agent,
                "reason": h.reason,
                "summary": h.context_summary,
                "ts": h.timestamp.isoformat(),
            }
            for h in self.handoff_history
        ]
