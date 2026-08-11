"""
VoicePay — Outbound Caller Agent (Day 6)
Separate worker that places proactive outbound calls via LiveKit SIP + Twilio.

Usage:
    python src/outbound_caller.py dev

Triggered by dispatches from trigger_call.py or the LiveKit CLI:
    lk dispatch create --agent-name voicepay-outbound --new-room \
      --metadata '{"phone_number":"+919876543210","user_name":"Aman","purpose":"scheme_reminder"}'
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import ssl
import time
from datetime import datetime
from typing import Any

import certifi
from dotenv import load_dotenv
from livekit import api, rtc
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    RunContext,
    cli,
    function_tool,
    get_job_context,
    metrics,
    room_io,
    tokenize,
    WorkerOptions,
)
from livekit.plugins import deepgram, google, murf, noise_cancellation, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

from memory import log_call_outcome, mark_opted_out, close_pool
from outbound_prompts import build_outbound_system_prompt, build_voicemail_message

# -----------------------------------------------------------------------------
# Bootstrap
# -----------------------------------------------------------------------------
load_dotenv(".env.local")

ssl_ctx = ssl.create_default_context(cafile=certifi.where())

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)-22s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("voicepay.outbound")

# SIP trunk ID — set after running setup_sip_trunk.py
OUTBOUND_TRUNK_ID = os.environ.get("SIP_OUTBOUND_TRUNK_ID", "")

# Voice personas (subset for outbound — same as inbound)
VOICE_PERSONAS = {
    "anisha": {"voice": "Anisha", "locale": "en-IN", "style": "Conversation", "gender": "female"},
    "samar": {"voice": "Samar", "locale": "en-IN", "style": "Conversation", "gender": "male"},
    "pooja": {"voice": "Pooja", "locale": "en-IN", "style": "Conversation", "gender": "female"},
}


# =============================================================================
# OUTBOUND AGENT
# =============================================================================

class OutboundCallerAgent(Agent):
    """Voice agent for proactive outbound calls — scheme reminders, alerts, follow-ups."""

    def __init__(
        self,
        *,
        user_name: str,
        phone_number: str,
        purpose: str,
        language: str = "en",
        persona_name: str = "Anisha",
        facts: dict[str, Any] | None = None,
        user_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ):
        self._user_name = user_name
        self._phone_number = phone_number
        self._purpose = purpose
        self._language = language
        self._persona_name = persona_name
        self._facts = facts or {}
        self._user_id = user_id
        self._metadata = metadata or {}
        self._call_start: float | None = None
        self._participant: rtc.RemoteParticipant | None = None

        # Build the outbound system prompt
        # Filter metadata to only include extra fields not already passed as named args
        excluded_keys = {'user_name', 'persona_name', 'purpose', 'language', 'facts',
                         'phone_number', 'persona', 'user_id', 'attempt', 'triggered_at'}
        extra_kwargs = {k: v for k, v in (metadata or {}).items()
                        if isinstance(v, str) and k not in excluded_keys}
        instructions = build_outbound_system_prompt(
            persona_name=persona_name,
            user_name=user_name,
            purpose=purpose,
            language=language,
            facts=facts,
            **extra_kwargs,
        )

        super().__init__(instructions=instructions)

    def set_participant(self, p: rtc.RemoteParticipant):
        self._participant = p
        self._call_start = time.time()

    def _duration(self) -> int:
        if self._call_start:
            return int(time.time() - self._call_start)
        return 0

    async def _hangup(self, outcome: str, summary: str = ""):
        """End the call and log outcome."""
        duration = self._duration()
        logger.info(
            "CALL ENDED: outcome=%s duration=%ds phone=%s user=%s",
            outcome, duration, self._phone_number, self._user_name,
        )

        # Log to database
        try:
            await log_call_outcome(
                user_id=self._user_id,
                phone_number=self._phone_number,
                purpose=self._purpose,
                outcome=outcome,
                duration_s=duration,
                attempt=self._metadata.get("attempt", 1),
                persona=self._persona_name.lower(),
                summary=summary,
            )
        except Exception as e:
            logger.warning("Failed to log call outcome: %s", e)

        # Delete room = hang up SIP call
        try:
            job_ctx = get_job_context()
            await job_ctx.api.room.delete_room(
                api.DeleteRoomRequest(room=job_ctx.room.name)
            )
        except Exception as e:
            logger.warning("Failed to delete room (hangup): %s", e)

    # -----------------------------------------------------------------
    # TOOLS — Outbound-specific
    # -----------------------------------------------------------------

    @function_tool
    async def end_call(self, context: RunContext) -> str:
        """End the outbound call gracefully. Call this when:
        - You've delivered the message and the user acknowledges
        - The conversation is naturally concluding
        - You've said goodbye

        Always say goodbye before calling this tool.
        """
        # Wait for current speech to finish
        current = context.session.current_speech
        if current:
            await current.wait_for_playout()
        await self._hangup("answered", "Call completed normally")
        return "Call ended successfully. The user has been disconnected."

    @function_tool
    async def mark_opted_out(self, context: RunContext) -> str:
        """Mark the user as opted out of future outbound calls. Call this IMMEDIATELY when:
        - User says "don't call me again", "stop calling", "mat karo call"
        - User explicitly refuses future calls
        - User says "opt out", "unsubscribe", "remove my number"

        After calling this, confirm to the user that they won't be called again, then end the call.
        """
        if self._user_id:
            try:
                await mark_opted_out(self._user_id)
                logger.info("User opted out: %s", self._user_id)
            except Exception as e:
                logger.warning("Failed to mark opted out: %s", e)

        await self._hangup("opted_out", "User requested opt-out")
        return "OPTED OUT: User has been marked as opted out. Confirm to them: 'Bilkul, hum aapko aage se call nahi karenge. Aapka data safe hai. Dhanyavaad!' Then the call will end."

    @function_tool
    async def detected_voicemail(self, context: RunContext) -> str:
        """Call this when you detect a voicemail greeting or answering machine.
        Signs of voicemail:
        - "Please leave a message after the beep"
        - Automated/recorded greeting that doesn't respond to you
        - A beep tone
        - "The person you are calling is not available"

        Do NOT leave a long message. Keep it under 10 seconds.
        """
        voicemail_msg = build_voicemail_message(
            self._persona_name, self._user_name, self._purpose,
        )
        # Say the voicemail message, then hang up
        await context.session.generate_reply(
            instructions=f"Say this voicemail message naturally: '{voicemail_msg}' — then call end_call."
        )
        await self._hangup("voicemail", "Voicemail detected, left brief message")
        return "Voicemail detected. Brief message left. Call ending."

    @function_tool
    async def schedule_callback(
        self, context: RunContext, preferred_time: str = ""
    ) -> str:
        """Schedule a callback for later. Call when user says:
        - "Call me later", "baad mein call karo"
        - "I'm busy right now"
        - "Not a good time"

        Args:
            preferred_time: When the user wants to be called back (if they said).
        """
        logger.info("Callback requested: user=%s time=%s", self._user_name, preferred_time)
        await self._hangup("callback_requested", f"User requested callback: {preferred_time}")
        return f"CALLBACK SCHEDULED: Tell the user 'Theek hai, hum aapko {preferred_time or 'baad mein'} call karenge. Dhanyavaad!' Then end naturally."

    @function_tool
    async def transfer_to_human(self, context: RunContext) -> str:
        """Transfer the call to a human agent. Call when:
        - User explicitly asks for a human: "insaan se baat karao", "talk to human"
        - Issue is too complex for AI
        - User is distressed or upset

        Note: In this demo, we can't actually transfer. Inform and provide helpline.
        """
        await self._hangup("transfer_requested", "User requested human agent")
        return "TRANSFER: Tell the user 'Abhi hamare team mein koi available nahi hai. Aap humari helpline 1800-XXX-XXXX pe call kar sakte hain ya app pe request raise kar sakte hain. Sorry for the inconvenience.' Then end."


# =============================================================================
# ENTRYPOINT — receives dispatches and places calls
# =============================================================================

async def entrypoint(ctx: JobContext):
    """Main entrypoint for outbound call worker."""
    logger.info("Outbound call dispatch received")

    await ctx.connect()

    # --- Parse dispatch metadata ---
    try:
        metadata = json.loads(ctx.job.metadata) if ctx.job.metadata else {}
    except (json.JSONDecodeError, TypeError):
        logger.error("Invalid dispatch metadata — cannot place call")
        ctx.shutdown()
        return

    phone_number = metadata.get("phone_number", "")
    user_name = metadata.get("user_name", "User")
    purpose = metadata.get("purpose", "general_reminder")
    language = metadata.get("language", "en")
    persona_id = metadata.get("persona", "anisha")
    facts = metadata.get("facts", {})
    user_id = metadata.get("user_id")

    # --- Route to Linphone SIP URI ---
    # When using Linphone trunk, convert any phone number to just the SIP username
    # The trunk already knows the domain (sip.linphone.org), so we only pass the user part
    linphone_uri = os.environ.get("LINPHONE_SIP_URI", "")
    if linphone_uri and not phone_number.startswith("sip:"):
        # Extract just the username from sip:aman021998@sip.linphone.org → aman021998
        sip_user = linphone_uri.replace("sip:", "").split("@")[0]
        sip_call_to = sip_user
        logger.info("Routing %s → %s (Linphone SIP user)", phone_number, sip_call_to)
    elif phone_number.startswith("sip:"):
        # Full SIP URI passed — extract just the user part
        sip_call_to = phone_number.replace("sip:", "").split("@")[0]
    else:
        sip_call_to = phone_number

    if not phone_number:
        logger.error("No phone_number in dispatch metadata")
        ctx.shutdown()
        return

    if not OUTBOUND_TRUNK_ID:
        logger.error("SIP_OUTBOUND_TRUNK_ID not set — cannot place outbound call")
        ctx.shutdown()
        return

    # --- Resolve persona ---
    persona = VOICE_PERSONAS.get(persona_id, VOICE_PERSONAS["anisha"])
    persona_name = persona["voice"]

    logger.info(
        "OUTBOUND CALL: phone=%s user=%s purpose=%s persona=%s",
        phone_number, user_name, purpose, persona_name,
    )

    # --- Create agent ---
    agent = OutboundCallerAgent(
        user_name=user_name,
        phone_number=phone_number,
        purpose=purpose,
        language=language,
        persona_name=persona_name,
        facts=facts,
        user_id=user_id,
        metadata=metadata,
    )

    # --- Build session pipeline (same quality as inbound) ---
    session = AgentSession(
        stt=deepgram.STT(
            model="nova-3",
            language="multi",
            smart_format=True,
        ),
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
        vad=ctx.proc.userdata.get("vad"),
        preemptive_generation=True,
    )

    # --- Start session BEFORE dialing (so agent is ready when callee picks up) ---
    session_task = asyncio.create_task(
        session.start(
            agent=agent,
            room=ctx.room,
            room_input_options=room_io.RoomInputOptions(
                noise_cancellation=noise_cancellation.BVCTelephony(),
            ),
        )
    )

    # --- Place the outbound call ---
    try:
        logger.info("Dialing %s via SIP trunk %s...", sip_call_to, OUTBOUND_TRUNK_ID)

        await ctx.api.sip.create_sip_participant(
            api.CreateSIPParticipantRequest(
                room_name=ctx.room.name,
                sip_trunk_id=OUTBOUND_TRUNK_ID,
                sip_call_to=sip_call_to,
                participant_identity=phone_number,
                wait_until_answered=True,
            )
        )

        # Call was answered!
        await session_task
        logger.info("Call answered! Waiting for participant...")

        participant = await ctx.wait_for_participant(identity=phone_number)
        agent.set_participant(participant)
        logger.info("Participant connected: %s — conversation starting", phone_number)

    except Exception as e:
        # --- Handle call failure ---
        error_str = str(e)
        logger.error("Outbound call failed: %s", error_str)

        # Determine outcome from error
        outcome = "failed"
        if "486" in error_str or "busy" in error_str.lower():
            outcome = "busy"
        elif "480" in error_str or "487" in error_str or "timeout" in error_str.lower():
            outcome = "no_answer"
        elif "603" in error_str or "decline" in error_str.lower():
            outcome = "declined"

        # Log the failure
        try:
            await log_call_outcome(
                user_id=user_id,
                phone_number=phone_number,
                purpose=purpose,
                outcome=outcome,
                duration_s=0,
                attempt=metadata.get("attempt", 1),
                persona=persona_name.lower(),
                summary=f"Call failed: {error_str[:200]}",
            )
        except Exception:
            pass

        ctx.shutdown()
        return

    # --- Cleanup on session end ---
    @session.on("close")
    async def _on_close(*args):
        logger.info("Session closed for outbound call to %s", phone_number)
        await close_pool()


# =============================================================================
# WORKER SETUP
# =============================================================================

def prewarm(proc):
    """Pre-load VAD model for faster startup."""
    proc.userdata["vad"] = silero.VAD.load()
    logger.info("Outbound worker prewarm complete — Silero VAD loaded")


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
            agent_name="voicepay-outbound",
        )
    )
