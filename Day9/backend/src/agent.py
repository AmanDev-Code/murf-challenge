"""
=============================================================================
 VoicePay — AI Voice Banking Assistant for Bharat (Day 9: Multi-Agent)
 Track:  Financial Services  |  #VoiceForBharat
 Event:  10 Days of Voice Agents (Murf x LiveKit)
 Stack:  LiveKit Agents 1.4 · Deepgram Nova-3 · Gemini 2.5 Flash Lite · Murf Falcon-2
=============================================================================

Day 9 Architecture: 6 Specialized Agents with Handoff Orchestration
---------------------------------------------------------------------
This file is the SESSION WIRING LAYER only. It:
  1. Connects to the LiveKit room
  2. Resolves persona and user memory
  3. Constructs VoicePayState (shared across all agents)
  4. Configures STT/LLM/TTS pipeline
  5. Wires metrics, security scanning, and event handlers
  6. Starts the TriageAgent as the entry point
  7. Persists session analytics on shutdown

All business logic lives in agents/ — one file per specialist.
"""

from __future__ import annotations

import asyncio
import json as _json
import logging
import os
import re
import ssl
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

# -----------------------------------------------------------------------------
# SSL Fix for macOS Python 3.13
# -----------------------------------------------------------------------------
import certifi

os.environ.setdefault("SSL_CERT_FILE", certifi.where())
os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())
ssl._create_default_https_context = lambda purpose=None, cafile=None, capath=None: ssl.create_default_context(
    purpose=purpose or ssl.Purpose.SERVER_AUTH,
    cafile=cafile or certifi.where(),
    capath=capath,
)

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    cli,
    metrics,
    room_io,
    tokenize,
)
from livekit.agents.metrics import (
    EOUMetrics,
    LLMMetrics,
    STTMetrics,
    TTSMetrics,
)
from livekit.plugins import deepgram, google, murf, noise_cancellation, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

from memory import close_pool, get_pool, lookup_user, touch_user
from conversation_logger import ConversationLogger
from escalation import detect_escalation_trigger
from state import VoicePayState
from handoff import persist_session_end_analytics

# -----------------------------------------------------------------------------
# Bootstrap
# -----------------------------------------------------------------------------
load_dotenv(".env.local")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)-22s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("voicepay")
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)


# =============================================================================
# VOICE PERSONAS
# =============================================================================
VOICE_PERSONAS: dict[str, dict[str, Any]] = {
    "anisha": {
        "voice": "Anisha",
        "locale": "en-IN",
        "style": "Conversation",
        "name_display": "Anisha",
        "gender": "female",
        "tagline": "Warm & Trustworthy",
        "description": "A caring, patient voice that makes banking feel like talking to a trusted friend.",
        "greeting": "Hello! I'm Anisha, your VoicePay assistant. How can I help you today with your banking needs?",
        "personality": "warm, patient, nurturing, uses soft encouragement",
        "coverage": ["en-IN", "hi-IN", "ta-IN", "bn-IN", "kn-IN", "ml-IN", "mr-IN", "pa-IN", "te-IN", "as-IN", "or-IN"],
    },
    "samar": {
        "voice": "Samar",
        "locale": "en-IN",
        "style": "Conversation",
        "name_display": "Samar",
        "gender": "male",
        "tagline": "Confident & Professional",
        "description": "A knowledgeable banker who explains complex finance in simple terms.",
        "greeting": "Hello! I'm Samar from VoicePay. Let's sort out your financial questions today!",
        "personality": "confident, professional, clear, uses business-like precision",
        "coverage": ["en-IN", "hi-IN", "as-IN", "kn-IN", "or-IN", "te-IN"],
    },
    "pooja": {
        "voice": "Pooja",
        "locale": "en-IN",
        "style": "Conversation",
        "name_display": "Pooja",
        "gender": "female",
        "tagline": "Friendly & Bilingual",
        "description": "Switches seamlessly between Hindi and English — perfect for everyday Hinglish conversations.",
        "greeting": "Hello! I'm Pooja from VoicePay. Tell me, how can I help you today?",
        "personality": "friendly, casual, youthful, uses contemporary Hinglish naturally",
        "coverage": ["en-IN", "hi-IN"],
    },
}

DEFAULT_PERSONA = "anisha"


def get_persona(persona_id: str | None) -> dict[str, Any]:
    if persona_id and persona_id.lower() in VOICE_PERSONAS:
        return VOICE_PERSONAS[persona_id.lower()]
    return VOICE_PERSONAS[DEFAULT_PERSONA]


# =============================================================================
# OUTPUT VALIDATION — strips hallucinated code before TTS
# =============================================================================
_CODE_BLOCK_STRIP = re.compile(r"```[\s\S]*?```", re.MULTILINE)
_TOOL_CODE_STRIP = re.compile(r"(?:call\s+)?print\s*\(.*?\)\s*;?\s*", re.IGNORECASE | re.DOTALL)
_DEFAULT_API_STRIP = re.compile(r"default_api\.\w+\([^)]*\)\s*", re.IGNORECASE)


def sanitize_agent_output(text: str) -> str:
    if not text:
        return text
    result = _CODE_BLOCK_STRIP.sub("", text)
    result = _TOOL_CODE_STRIP.sub("", result)
    result = _DEFAULT_API_STRIP.sub("", result)
    result = re.sub(r"\n{2,}", "\n", result).strip()
    return result


# =============================================================================
# LATENCY TRACKING
# =============================================================================
@dataclass
class LatencySnapshot:
    eou_delay_ms: float | None = None
    llm_ttft_ms: float | None = None
    tts_ttfb_ms: float | None = None
    total_ms: float | None = None


# =============================================================================
# SERVER + SESSION WIRING
# =============================================================================
server = AgentServer()


def prewarm(proc: JobProcess) -> None:
    proc.userdata["vad"] = silero.VAD.load()
    logger.info("prewarm complete — Silero VAD loaded")


server.setup_fnc = prewarm


@server.rtc_session(agent_name="voicepay")
async def voicepay_session(ctx: JobContext) -> None:
    """Handler for every incoming VoicePay voice session — 6-agent multi-specialist system."""

    ctx.log_context_fields = {
        "room": ctx.room.name,
        "agent": "voicepay-multiagent",
        "track": "financial-services",
        "day": "9",
    }
    logger.info("session starting room=%s (Day 9 — multi-agent)", ctx.room.name)

    # -------------------------------------------------------------------
    # Connect
    # -------------------------------------------------------------------
    await ctx.connect()
    logger.info("connected to room=%s", ctx.room.name)

    # -------------------------------------------------------------------
    # Resolve voice persona from room metadata
    # -------------------------------------------------------------------
    persona_id: str | None = None

    def _try_parse_voice(raw: str | None) -> str | None:
        if not raw:
            return None
        try:
            return _json.loads(raw).get("voice")
        except (ValueError, TypeError):
            return None

    persona_id = _try_parse_voice(ctx.room.metadata)
    if not persona_id:
        try:
            job_meta = getattr(ctx.job, "metadata", None) or getattr(ctx, "metadata", None)
            persona_id = _try_parse_voice(job_meta)
        except Exception:
            pass

    persona = get_persona(persona_id)
    logger.info("persona=%s voice=%s", persona["name_display"], persona["voice"])

    # -------------------------------------------------------------------
    # User identity + memory lookup
    # -------------------------------------------------------------------
    user_memory: dict[str, Any] | None = None
    user_id: str | None = None

    await asyncio.sleep(0.5)
    for participant in ctx.room.remote_participants.values():
        user_id = participant.identity
        break

    if not user_id:
        user_id = ctx.room.name
        logger.info("no remote participant identity — using room name")

    try:
        user_memory = await lookup_user(user_id)
        if user_memory:
            logger.info("MEMORY HIT: user=%s name=%s", user_id, user_memory.get("name"))
            await touch_user(user_id)
        else:
            logger.info("MEMORY MISS: new user=%s", user_id)
    except Exception as e:
        logger.warning("Memory lookup failed: %s", e)
        user_memory = None

    # -------------------------------------------------------------------
    # Detect channel (browser vs SIP)
    # -------------------------------------------------------------------
    call_channel = "browser"
    for p in ctx.room.remote_participants.values():
        if getattr(p, "kind", None) == rtc.ParticipantKind.PARTICIPANT_KIND_SIP:
            call_channel = "sip"
        break

    # -------------------------------------------------------------------
    # Build shared state
    # -------------------------------------------------------------------
    state = VoicePayState(
        user_id=user_id or "",
        user_name=user_memory.get("name", "") if user_memory else "",
        verified=False,
        consent_given=user_memory.get("consent_given", False) if user_memory else False,
        user_memory=user_memory or {},
        room_name=ctx.room.name,
        language="english",
        persona_id=(persona_id or "anisha").lower(),
        channel=call_channel,
        started_at=time.time(),
    )

    # -------------------------------------------------------------------
    # Pipeline construction: STT → LLM → TTS
    # -------------------------------------------------------------------
    session = AgentSession(
        stt=deepgram.STT(model="nova-3", language="multi", smart_format=True),
        llm=google.LLM(
            model=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash-lite"),
            temperature=0.7,
        ),
        tts=murf.TTS(
            voice=persona["voice"],
            style=persona["style"],
            model="falcon-2",
            sample_rate=48000,
            locale=persona["locale"],
            speed=0,
            pitch=0,
            tokenizer=tokenize.basic.SentenceTokenizer(min_sentence_len=2),
            text_pacing=False,
        ),
        turn_detection=MultilingualModel(unlikely_threshold=0.3),
        vad=ctx.proc.userdata["vad"],
        preemptive_generation=True,
    )

    # Attach state to session (all agents access via session.userdata)
    session.userdata = state

    # -------------------------------------------------------------------
    # Conversation Logger
    # -------------------------------------------------------------------
    conv_logger = ConversationLogger(
        room_name=ctx.room.name,
        user_id=user_id,
        persona=persona["name_display"],
    )
    state.conv_logger = conv_logger
    state.room = ctx.room

    # -------------------------------------------------------------------
    # Latency tracking
    # -------------------------------------------------------------------
    latencies: list[LatencySnapshot] = []
    current_latency = LatencySnapshot()

    def _commit_latency() -> None:
        nonlocal current_latency
        parts = [x for x in (current_latency.eou_delay_ms, current_latency.llm_ttft_ms, current_latency.tts_ttfb_ms) if x]
        if parts:
            current_latency.total_ms = sum(parts)
            latencies.append(current_latency)
        current_latency = LatencySnapshot()

    # -------------------------------------------------------------------
    # Text sanitization — strip hallucinated tool code before TTS
    # -------------------------------------------------------------------
    @session.on("agent_speech_created")
    def _on_speech_created(ev: Any) -> None:
        try:
            source = getattr(ev, "source", None) or getattr(ev, "text", None)
            if not source:
                return
            if re.search(r"print\s*\(|default_api\.|tool_code|```", source, re.I):
                cleaned = sanitize_agent_output(source)
                if cleaned != source:
                    logger.warning("SANITIZED hallucinated code from output")
                    if hasattr(ev, "text"):
                        ev.text = cleaned
                    if hasattr(ev, "source"):
                        ev.source = cleaned
        except Exception:
            pass

    # -------------------------------------------------------------------
    # Metrics wiring
    # -------------------------------------------------------------------
    usage = metrics.UsageCollector()

    @session.on("metrics_collected")
    def _on_metrics(ev: Any) -> None:
        nonlocal current_latency
        try:
            m = ev.metrics
            metrics.log_metrics(m)
            usage.collect(m)
            if isinstance(m, EOUMetrics):
                current_latency.eou_delay_ms = float(m.end_of_utterance_delay) * 1000
            elif isinstance(m, LLMMetrics):
                if getattr(m, "ttft", None) is not None:
                    current_latency.llm_ttft_ms = float(m.ttft) * 1000
            elif isinstance(m, TTSMetrics):
                if getattr(m, "ttfb", None) is not None:
                    current_latency.tts_ttfb_ms = float(m.ttfb) * 1000
                    _commit_latency()
                    last = latencies[-1] if latencies else None
                    if last and last.total_ms:
                        logger.info(
                            "TURN LATENCY eou=%.0fms llm=%.0fms tts=%.0fms total=%.0fms",
                            last.eou_delay_ms or 0, last.llm_ttft_ms or 0,
                            last.tts_ttfb_ms or 0, last.total_ms,
                        )
        except Exception:
            logger.exception("metrics handler error")

    # -------------------------------------------------------------------
    # User input handler — language detection + escalation/credential scan
    # -------------------------------------------------------------------
    @session.on("user_input_transcribed")
    def _on_user_input(ev: Any) -> None:
        if not getattr(ev, "is_final", False):
            return
        state.user_turns += 1
        transcript = getattr(ev, "transcript", "") or ""
        logger.info("user: %s", transcript[:160])

        # Language detection
        hindi_chars = len(re.findall(r"[ऀ-ॿ]", transcript))
        hindi_words = len(re.findall(
            r"\b(kya|hai|mera|meri|karo|batao|chahiye|hoon|nahi|aur|bhi|ka|ki|ke|se|ko|ho|ye|wo|kaise|kitna|kitni|kab|kahan)\b",
            transcript.lower()
        ))
        if hindi_chars > 5 or hindi_words >= 3:
            state.language = "hindi"
        elif hindi_words >= 1:
            state.language = "hinglish"

        # Log user message (fire-and-forget)
        asyncio.ensure_future(conv_logger.log_user_message(transcript, language=state.language))

        # Escalation trigger detection
        trigger = detect_escalation_trigger(transcript)
        if trigger:
            logger.info("ESCALATION TRIGGER: type=%s", trigger["type"])
            state.escalation_pending = True
            state.escalation_context = trigger

        # Credential detection (Layer 2 security)
        digits = re.findall(r"\b\d{4,8}\b", transcript)
        keywords = ("otp", "pin", "cvv", "password", "one time", "passcode", "secret")
        if digits and any(k in transcript.lower() for k in keywords):
            state.credential_detected = True
            state.security_blocks += 1
            logger.warning("CREDENTIAL DETECTED — routing to SecurityAgent")

        # Aadhaar pattern (12 digits)
        if re.search(r"\b\d{4}\s?\d{4}\s?\d{4}\b", transcript):
            state.credential_detected = True
            state.security_blocks += 1

        # Card number (16 digits)
        if re.search(r"\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b", transcript):
            state.credential_detected = True
            state.security_blocks += 1

    @session.on("agent_state_changed")
    def _on_agent_state(ev: Any) -> None:
        if getattr(ev, "new_state", None) == "speaking":
            state.agent_turns += 1

    @session.on("agent_speech_committed")
    def _on_agent_speech(ev: Any) -> None:
        text = getattr(ev, "text", "") or getattr(ev, "content", "")
        if text:
            asyncio.ensure_future(conv_logger.log_agent_message(text))

    # -------------------------------------------------------------------
    # Voice switch handler (mid-session persona change via data channel)
    # -------------------------------------------------------------------
    @ctx.room.on("data_received")
    def _on_data(data_packet: Any) -> None:
        try:
            raw = data_packet.data if hasattr(data_packet, "data") else data_packet
            if isinstance(raw, (bytes, bytearray)):
                payload = raw.decode("utf-8")
            else:
                payload = str(raw)

            msg = _json.loads(payload)
            if msg.get("type") != "voice_switch":
                return
            new_voice_id = msg.get("voice", "").lower()
            if new_voice_id not in VOICE_PERSONAS:
                return

            new_persona = VOICE_PERSONAS[new_voice_id]
            logger.info("VOICE SWITCH: %s → %s", persona["name_display"], new_persona["name_display"])

            new_tts = murf.TTS(
                voice=new_persona["voice"],
                style=new_persona["style"],
                model="falcon-2",
                sample_rate=48000,
                locale=new_persona["locale"],
                speed=0,
                pitch=0,
                tokenizer=tokenize.basic.SentenceTokenizer(min_sentence_len=2),
                text_pacing=False,
            )
            session._tts = new_tts
            state.persona_id = new_voice_id
        except Exception as exc:
            logger.debug("data_received parse error: %s", exc)

    # -------------------------------------------------------------------
    # Session shutdown — persist analytics
    # -------------------------------------------------------------------
    async def _log_session_summary() -> None:
        totals = [s.total_ms for s in latencies if s.total_ms]
        avg_latency = sum(totals) / len(totals) if totals else 0.0
        p95_latency = sorted(totals)[int(len(totals) * 0.95) - 1] if len(totals) >= 20 else max(totals or [0])
        duration_s = round(time.time() - state.started_at, 1)

        logger.info("=" * 60)
        logger.info("SESSION SUMMARY  room=%s", state.room_name)
        logger.info("  duration       : %.1fs", duration_s)
        logger.info("  user turns     : %d", state.user_turns)
        logger.info("  agent turns    : %d", state.agent_turns)
        logger.info("  handoffs       : %d", state.handoff_count)
        logger.info("  agents used    : %s", state.agents_used())
        logger.info("  tool calls     : %s", state.tool_calls or "none")
        logger.info("  security blocks: %d", state.security_blocks)
        logger.info("  latency (ms)   : avg=%.0f p95=%.0f over %d turns", avg_latency, p95_latency, len(totals))
        logger.info("=" * 60)

        # Persist call analytics
        try:
            pool = await get_pool()
            tool_names = set(state.tool_calls.keys()) if state.tool_calls else set()

            # Success criteria
            success_criteria: list[str] = []
            if tool_names & {"scheme_eligibility", "loan_eligibility"}:
                success_criteria.append("eligibility_check")
            if "document_checklist" in tool_names:
                success_criteria.append("document_list")
            if tool_names & {"gold_silver_prices", "rbi_rates", "fd_rate_comparison"}:
                success_criteria.append("rate_info")
            if "emi_calculator" in tool_names:
                success_criteria.append("emi_calculation")
            if "create_escalation_ticket" in tool_names:
                success_criteria.append("escalation_created")
            if state.security_blocks > 0:
                success_criteria.append("scam_education")

            # Outcome classification
            if state.user_turns == 0:
                outcome, outcome_reason = "abandoned", "User disconnected before interaction"
            elif state.tool_errors > 0 and not success_criteria:
                outcome, outcome_reason = "error", f"Tool errors: {state.tool_errors}"
            elif success_criteria:
                outcome, outcome_reason = "success", f"Criteria: {', '.join(success_criteria)}"
            else:
                outcome, outcome_reason = "failed", "No success criteria met"

            # Latency breakdown
            eou_vals = [s.eou_delay_ms for s in latencies if s.eou_delay_ms]
            llm_vals = [s.llm_ttft_ms for s in latencies if s.llm_ttft_ms]
            tts_vals = [s.tts_ttfb_ms for s in latencies if s.tts_ttfb_ms]
            latency_breakdown = _json.dumps({
                "eou_avg": round(sum(eou_vals) / len(eou_vals), 1) if eou_vals else 0,
                "llm_avg": round(sum(llm_vals) / len(llm_vals), 1) if llm_vals else 0,
                "tts_avg": round(sum(tts_vals) / len(tts_vals), 1) if tts_vals else 0,
                "samples_count": len(latencies),
            })

            async with pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO call_analytics (
                        room_name, user_id, persona, channel,
                        started_at, ended_at, duration_s,
                        user_turns, agent_turns,
                        tool_calls, tools_used, tool_errors,
                        security_blocks, escalations, language,
                        outcome, outcome_reason, success_criteria_met,
                        avg_latency_ms, p95_latency_ms, latency_breakdown,
                        handoff_count, agents_used, primary_agent, handoff_timeline
                    ) VALUES (
                        $1, $2, $3, $4,
                        to_timestamp($5), NOW(), $6,
                        $7, $8,
                        $9::jsonb, $10, $11,
                        $12, $13, $14,
                        $15, $16, $17,
                        $18, $19, $20::jsonb,
                        $21, $22, $23, $24::jsonb
                    )
                    ON CONFLICT (room_name) DO UPDATE SET
                        ended_at = NOW(),
                        duration_s = EXCLUDED.duration_s,
                        user_turns = EXCLUDED.user_turns,
                        agent_turns = EXCLUDED.agent_turns,
                        tool_calls = EXCLUDED.tool_calls,
                        tools_used = EXCLUDED.tools_used,
                        tool_errors = EXCLUDED.tool_errors,
                        security_blocks = EXCLUDED.security_blocks,
                        escalations = EXCLUDED.escalations,
                        outcome = EXCLUDED.outcome,
                        outcome_reason = EXCLUDED.outcome_reason,
                        success_criteria_met = EXCLUDED.success_criteria_met,
                        avg_latency_ms = EXCLUDED.avg_latency_ms,
                        p95_latency_ms = EXCLUDED.p95_latency_ms,
                        latency_breakdown = EXCLUDED.latency_breakdown,
                        handoff_count = EXCLUDED.handoff_count,
                        agents_used = EXCLUDED.agents_used,
                        primary_agent = EXCLUDED.primary_agent,
                        handoff_timeline = EXCLUDED.handoff_timeline
                    """,
                    state.room_name,
                    user_id,
                    persona.get("name_display", "anisha").lower(),
                    call_channel,
                    state.started_at,
                    int(duration_s),
                    state.user_turns,
                    state.agent_turns,
                    _json.dumps(state.tool_calls or {}),
                    list(tool_names),
                    state.tool_errors,
                    state.security_blocks,
                    state.escalations,
                    state.language,
                    outcome,
                    outcome_reason,
                    success_criteria,
                    round(avg_latency, 1),
                    round(p95_latency, 1),
                    latency_breakdown,
                    state.handoff_count,
                    state.agents_used(),
                    state.primary_agent(),
                    _json.dumps(state.handoff_timeline_json()),
                )
            logger.info("CALL ANALYTICS persisted: room=%s outcome=%s handoffs=%d", state.room_name, outcome, state.handoff_count)
        except Exception as e:
            logger.warning("call_analytics persist failed: %s", e)

        # Also persist agent-level session analytics
        await persist_session_end_analytics(state)

        try:
            await close_pool()
        except Exception:
            pass

    ctx.add_shutdown_callback(_log_session_summary)

    # -------------------------------------------------------------------
    # Start the pipeline with TriageAgent
    # -------------------------------------------------------------------
    try:
        from agents.triage import TriageAgent

        triage = TriageAgent(persona=persona, user_memory=user_memory)

        await session.start(
            agent=triage,
            room=ctx.room,
            room_options=room_io.RoomOptions(
                audio_input=room_io.AudioInputOptions(
                    noise_cancellation=lambda params: (
                        noise_cancellation.BVCTelephony()
                        if params.participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP
                        else noise_cancellation.BVC()
                    ),
                ),
            ),
        )

        logger.info(
            "session started — VoicePay MULTI-AGENT live in room=%s as %s (6 specialists ready)",
            ctx.room.name,
            persona["name_display"],
        )
    except asyncio.CancelledError:
        logger.info("session cancelled — shutting down")
        raise
    except Exception:
        logger.exception("session startup failed")
        raise


# =============================================================================
# ENTRYPOINT — runs inbound agent (voicepay)
# Outbound runs separately: python src/outbound_caller.py dev
# =============================================================================
if __name__ == "__main__":
    cli.run_app(server)
