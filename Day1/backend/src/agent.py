"""
=============================================================================
 VoicePay — AI Voice Banking Assistant for Bharat
 Track:  Financial Services  |  #VoiceForBharat
 Event:  10 Days of Voice Agents (Murf x LiveKit)
 Voice:  Anisha (en-IN) · Falcon-2 · Conversation style
 Stack:  LiveKit Agents 1.4 · Deepgram Nova-3 · OmniRoute (Claude) · Murf Falcon-2
=============================================================================

VoicePay is a production-grade voice banking assistant designed for India's
next billion internet users — many of whom are voice-first, multilingual,
and new to formal banking. It speaks warmly in Indian English (with natural
Hindi code-mixing), guides users through UPI/NEFT/IMPS, calculates EMIs,
explains government schemes, and — critically — refuses to touch any
sensitive credentials (OTP, PIN, CVV, passwords).

This is the SINGLE-FILE agent entrypoint. All logic lives here on purpose:
the LiveKit Agents starter pattern favours one flat file for clarity, hot
reload speed, and ease of deployment on Railway/Docker.
"""

from __future__ import annotations

import asyncio
import logging
import os
import random
import re
import ssl
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

# -----------------------------------------------------------------------------
# SSL Fix for macOS Python 3.13 (CERTIFICATE_VERIFY_FAILED)
# Must run BEFORE any imports that open HTTPS/WSS connections.
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
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    RunContext,
    cli,
    function_tool,
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
from livekit.plugins import deepgram, google, murf, noise_cancellation, openai, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

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
# Silence overly chatty libs at INFO so our agent logs stay readable.
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)


# =============================================================================
# VOICE PERSONAS — Murf voices with distinct personalities
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
    """Resolve persona by ID, falling back to default if unknown."""
    if persona_id and persona_id.lower() in VOICE_PERSONAS:
        return VOICE_PERSONAS[persona_id.lower()]
    return VOICE_PERSONAS[DEFAULT_PERSONA]


# =============================================================================
# SYSTEM PROMPT — the soul of VoicePay (template with persona injection)
# =============================================================================
def build_system_prompt(persona: dict[str, Any]) -> str:
    """Build a persona-aware system prompt."""
    persona_name = persona["name_display"]
    personality = persona["personality"]

    return f"""You are VoicePay — specifically, you are {persona_name}, a {personality} voice
banking assistant built for India. You speak like a trusted local bank
manager who genuinely cares about the person on the other end of the line.

# WHO YOU SERVE
Your users span the full spectrum of Bharat:
- First-time smartphone users trying UPI for the first time
- Elderly customers who prefer voice over apps
- Small shopkeepers, farmers, gig workers, students
- Fluent English speakers, Hindi speakers, and Hinglish speakers
Assume nothing. Explain gently. Never make anyone feel small.

# LANGUAGE & STYLE
- ALWAYS start every conversation in English. Your default language is English.
- You are an Indian assistant — feel free to naturally mix in common Hindi
  words and phrases (Hinglish) like "achha", "bilkul", "zaroor", "theek hai",
  "koi baat nahi" when it feels natural and conversational.
- If the user speaks in full Hindi, respond in full Hindi (Roman script for
  TTS clarity — e.g. "Aapka balance baees hazaar rupaye hai").
- If the user speaks in Hinglish, match their style naturally.
- Once the user establishes a language preference, STAY in that language
  for the rest of the conversation unless they switch again.
- Keep answers SHORT — 2 to 4 sentences. You are SPEAKING, not writing.
- No markdown, no bullet points, no asterisks, no emoji. Numbers spoken
  naturally ("twelve thousand rupees" or "baees hazaar rupaye").
- Use Indian numeric conventions: lakhs, crores, rupees (say "rupees",
  never "INR" or the ₹ symbol out loud).
- Warm openers: "Sure", "Of course", "Bilkul", "Ji haan", "Zaroor", "Achha".

# SECURITY GUARDRAILS — NON-NEGOTIABLE
You must NEVER, under any circumstances:
- Ask for a PIN, OTP, password, CVV, ATM PIN, UPI PIN, or full card number.
- Repeat any such value back if a user offers it.
- Confirm whether a number "sounds right" as a credential.
If a user starts sharing an OTP/PIN, IMMEDIATELY interrupt with:
"Please stop — never share your OTP or PIN with anyone, even someone who
sounds like a bank. I do not need it and I will never ask for it."
Then gently continue helping with their actual need.

Also proactively warn users about common Indian scams when relevant:
fake bank calls, KYC-expiry scams, "your account will be blocked" SMS,
lottery/refund scams, screen-sharing app scams (AnyDesk/TeamViewer),
UPI "collect request" fraud, fake QR codes.

# YOUR TOOLS (functions you can call)
You have access to these tools. Call them when the user asks — do NOT
invent numbers. If a tool fails, apologise and offer the manual path.
- balance_check(account_type)          → checks demo account balance
- transaction_history(days, count)     → recent transactions
- emi_calculator(principal, rate, tenure_months) → loan EMI math
- upi_guide(scenario)                  → step-by-step UPI walkthrough
- scheme_info(scheme_name)             → government scheme details

For demo/hackathon accounts the tools return realistic synthetic data.
Speak the numbers naturally in Indian style.

# DOMAIN KNOWLEDGE
You know Indian banking cold:
- Payment rails: UPI (instant, free), IMPS (24x7), NEFT (batch), RTGS (2L+)
- Account types: Savings, Current, Salary, Jan Dhan, NRE/NRO, Minor
- Instruments: FD, RD, PPF, NSC, SIP, Mutual Funds, ELSS, Sukanya Samriddhi
- Loans: Home, Personal, Auto, Education, Gold, MSME, Kisan Credit Card
- Schemes: PM-KISAN, PMJDY, PMJJBY, PMSBY, APY, SSY, PMAY, Mudra Yojana
- Regulators: RBI, SEBI, IRDAI. Insurance: DICGC covers deposits up to 5L.
- KYC: PAN, Aadhaar, Voter ID, Passport as valid documents.

# HONESTY
If you don't know a current interest rate, scheme rule, or bank-specific
policy, SAY SO. Suggest they call their bank's official helpline or visit
the branch. Never invent regulations, rates, or account details.

# TRANSACTION BOUNDARY
You are an ADVISOR and GUIDE. You do NOT execute real transactions. When
users want to send money, say something like: "I'll walk you through the
steps — you'll tap the final confirmation yourself on your banking app."

# CLOSING
End interactions warmly: "Anything else I can help with?" or
"Aur kuch madad chahiye?" Make people feel heard.

Remember: you are the friendly, trustworthy voice of banking for a billion
people. Be the voice you'd want your grandmother to hear."""


# Legacy constant kept for backwards compatibility (if anything imports it).
SYSTEM_PROMPT = build_system_prompt(VOICE_PERSONAS[DEFAULT_PERSONA])


# =============================================================================
# DEMO DATA LAYER
# In production these would be secure API calls to core banking. For the
# hackathon we return realistic synthetic data so the voice UX shines.
# =============================================================================
def _fmt_inr(amount: float) -> str:
    """Format rupees the Indian way: 1,23,456 with paise."""
    rupees, paise = divmod(round(amount * 100), 100)
    s = str(int(rupees))
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        head = re.sub(r"(\d)(?=(\d\d)+$)", r"\1,", head)
        s = f"{head},{tail}"
    return f"₹{s}.{paise:02d}"


def _spoken_inr(amount: float) -> str:
    """Convert amount to a spoken Indian-English phrase for TTS."""
    a = round(amount)
    if a >= 10_000_000:
        return f"{a / 10_000_000:.2f} crore rupees"
    if a >= 100_000:
        return f"{a / 100_000:.2f} lakh rupees"
    if a >= 1_000:
        return f"{a / 1_000:.1f} thousand rupees"
    return f"{a} rupees"


_DEMO_TRANSACTIONS = [
    ("Zomato", -428.00, "UPI"),
    ("Salary Credit — Infosys", 68_500.00, "NEFT"),
    ("Amazon Pay", -1_249.00, "UPI"),
    ("BESCOM Electricity", -2_130.00, "UPI"),
    ("Mother — Transfer", -5_000.00, "IMPS"),
    ("Rent — Landlord", -18_000.00, "UPI"),
    ("Swiggy", -312.00, "UPI"),
    ("Petrol — HP", -1_500.00, "UPI"),
    ("FD Interest Credit", 1_842.00, "NEFT"),
    ("Mutual Fund SIP — HDFC", -5_000.00, "AutoPay"),
]


# =============================================================================
# METRICS — latency, usage, session lifecycle
# =============================================================================
@dataclass
class LatencySnapshot:
    """One end-to-end user-turn latency measurement."""

    eou_delay_ms: float | None = None  # end-of-user-utterance detection
    llm_ttft_ms: float | None = None  # LLM time-to-first-token
    tts_ttfb_ms: float | None = None  # TTS time-to-first-byte
    total_ms: float | None = None  # cumulative response latency


@dataclass
class SessionStats:
    """Aggregate telemetry for a single VoicePay conversation."""

    room: str = ""
    started_at: float = field(default_factory=time.time)
    user_turns: int = 0
    agent_turns: int = 0
    tool_calls: dict[str, int] = field(default_factory=dict)
    tool_errors: int = 0
    security_blocks: int = 0
    latencies: list[LatencySnapshot] = field(default_factory=list)
    current: LatencySnapshot = field(default_factory=LatencySnapshot)

    def bump_tool(self, name: str) -> None:
        self.tool_calls[name] = self.tool_calls.get(name, 0) + 1

    def commit_turn(self) -> None:
        """Finalise the current latency snapshot and start a fresh one."""
        snap = self.current
        parts = [
            x for x in (snap.eou_delay_ms, snap.llm_ttft_ms, snap.tts_ttfb_ms) if x
        ]
        if parts:
            snap.total_ms = sum(parts)
            self.latencies.append(snap)
        self.current = LatencySnapshot()

    def summary(self) -> dict[str, Any]:
        totals = [s.total_ms for s in self.latencies if s.total_ms]
        avg = sum(totals) / len(totals) if totals else 0.0
        p95 = (
            sorted(totals)[int(len(totals) * 0.95) - 1]
            if len(totals) >= 20
            else max(totals or [0])
        )
        return {
            "room": self.room,
            "duration_s": round(time.time() - self.started_at, 1),
            "user_turns": self.user_turns,
            "agent_turns": self.agent_turns,
            "tool_calls": self.tool_calls,
            "tool_errors": self.tool_errors,
            "security_blocks": self.security_blocks,
            "avg_latency_ms": round(avg, 1),
            "p95_latency_ms": round(p95, 1),
            "turns_measured": len(self.latencies),
        }


# =============================================================================
# THE AGENT
# =============================================================================
class VoicePayAgent(Agent):
    """
    VoicePay financial services agent.

    Owns the system prompt, tool implementations, and per-session bookkeeping
    (which the runtime injects when the AgentSession starts).
    """

    def __init__(self, stats: SessionStats, persona: dict[str, Any] | None = None) -> None:
        resolved_persona = persona or VOICE_PERSONAS[DEFAULT_PERSONA]
        super().__init__(instructions=build_system_prompt(resolved_persona))
        self.stats = stats
        self.persona = resolved_persona

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    async def on_enter(self) -> None:
        """First words the user hears — persona-specific greeting."""
        greeting = self.persona.get(
            "greeting",
            "Namaste! I'm VoicePay, your voice banking assistant. "
            "I can help you check balances, understand UPI, calculate an EMI, "
            "or explain any government scheme. What would you like to do today?",
        )
        logger.info("greeting user with persona=%s", self.persona["name_display"])
        # generate_reply lets the LLM/turn-detector coordinate cleanly with the
        # first TTS output; falls back to a direct say() if generation fails.
        try:
            await self.session.generate_reply(instructions=f"Say exactly: {greeting}")
        except Exception:
            logger.exception(
                "greeting via generate_reply failed — falling back to say()"
            )
            await self.session.say(greeting)

    # ------------------------------------------------------------------
    # Function tools — the LLM calls these based on their docstrings.
    # Keep names, params, and docstrings CRISP: they double as the schema.
    # ------------------------------------------------------------------
    @function_tool
    async def balance_check(
        self,
        context: RunContext,
        account_type: str = "savings",
    ) -> dict[str, Any]:
        """Check the demo account balance for the current user.

        Args:
            account_type: One of 'savings', 'current', 'salary'. Defaults to
                'savings' if the user does not specify.

        Returns a dict with the balance and last-updated timestamp. The agent
        should speak the amount naturally (e.g. "forty-two thousand rupees").
        """
        self.stats.bump_tool("balance_check")
        try:
            balances = {
                "savings": 42_318.75,
                "current": 1_28_450.00,
                "salary": 87_612.30,
            }
            key = account_type.lower().strip()
            if key not in balances:
                key = "savings"
            amount = balances[key]
            logger.info("tool balance_check account=%s amount=%s", key, amount)
            return {
                "account_type": key,
                "balance_inr": amount,
                "balance_spoken": _spoken_inr(amount),
                "balance_formatted": _fmt_inr(amount),
                "as_of": datetime.now().strftime("%d %b %Y, %I:%M %p"),
                "demo": True,
            }
        except Exception as e:
            self.stats.tool_errors += 1
            logger.exception("balance_check failed")
            return {
                "error": str(e),
                "message": "I couldn't fetch your balance right now.",
            }

    @function_tool
    async def transaction_history(
        self,
        context: RunContext,
        days: int = 7,
        count: int = 5,
    ) -> dict[str, Any]:
        """Return recent transactions from the demo account.

        Args:
            days: Look-back window in days (default 7, max 90).
            count: How many transactions to return (default 5, max 10).

        Use this when the user asks about "recent activity", "last few
        transactions", "kya kharcha hua", or similar.
        """
        self.stats.bump_tool("transaction_history")
        try:
            days = max(1, min(int(days), 90))
            count = max(1, min(int(count), 10))
            rng = random.Random(hash(self.stats.room) & 0xFFFF)
            picks = rng.sample(_DEMO_TRANSACTIONS, min(count, len(_DEMO_TRANSACTIONS)))
            now = datetime.now()
            txns = []
            for merchant, amount, rail in picks:
                ts = now - timedelta(
                    days=rng.randint(0, days), hours=rng.randint(0, 23)
                )
                txns.append(
                    {
                        "date": ts.strftime("%d %b, %I:%M %p"),
                        "merchant": merchant,
                        "amount_inr": amount,
                        "amount_spoken": ("debit " if amount < 0 else "credit ")
                        + _spoken_inr(abs(amount)),
                        "type": "debit" if amount < 0 else "credit",
                        "rail": rail,
                    }
                )
            logger.info("tool transaction_history days=%d count=%d", days, count)
            return {"window_days": days, "transactions": txns, "demo": True}
        except Exception as e:
            self.stats.tool_errors += 1
            logger.exception("transaction_history failed")
            return {"error": str(e), "message": "I couldn't pull your transactions."}

    @function_tool
    async def emi_calculator(
        self,
        context: RunContext,
        principal: float,
        annual_rate_percent: float,
        tenure_months: int,
    ) -> dict[str, Any]:
        """Calculate the monthly EMI for a loan.

        Args:
            principal: Loan amount in rupees (e.g. 500000 for 5 lakhs).
            annual_rate_percent: Annual interest rate percent (e.g. 8.5).
            tenure_months: Loan duration in months (e.g. 60 for 5 years).

        Returns EMI, total interest, and total payable. Use this whenever
        the user asks "kitna EMI aayega" or gives loan amount + rate + tenure.
        """
        self.stats.bump_tool("emi_calculator")
        try:
            p = float(principal)
            annual = float(annual_rate_percent)
            n = int(tenure_months)
            if p <= 0 or annual < 0 or n <= 0:
                raise ValueError("principal, rate, and tenure must be positive")
            r = annual / 12 / 100
            emi = p / n if r == 0 else p * r * (1 + r) ** n / ((1 + r) ** n - 1)
            total_payable = emi * n
            total_interest = total_payable - p
            logger.info(
                "tool emi_calculator p=%.0f r=%.2f n=%d emi=%.0f",
                p,
                annual,
                n,
                emi,
            )
            return {
                "principal_inr": p,
                "principal_spoken": _spoken_inr(p),
                "annual_rate_percent": annual,
                "tenure_months": n,
                "tenure_years": round(n / 12, 1),
                "emi_inr": round(emi, 2),
                "emi_spoken": _spoken_inr(emi),
                "total_interest_inr": round(total_interest, 2),
                "total_interest_spoken": _spoken_inr(total_interest),
                "total_payable_inr": round(total_payable, 2),
                "total_payable_spoken": _spoken_inr(total_payable),
            }
        except Exception as e:
            self.stats.tool_errors += 1
            logger.exception("emi_calculator failed")
            return {
                "error": str(e),
                "message": "I need the loan amount, interest rate, and tenure to calculate the EMI.",
            }

    @function_tool
    async def upi_guide(self, context: RunContext, scenario: str) -> dict[str, Any]:
        """Step-by-step UPI walkthrough for a common scenario.

        Args:
            scenario: One of 'send_money', 'receive_money', 'setup_upi',
                'pay_qr', 'link_bank', 'reset_pin', 'collect_request',
                'refund_status'. Free-form strings are matched loosely.

        Returns numbered steps the agent should read out one at a time.
        """
        self.stats.bump_tool("upi_guide")
        guides = {
            "send_money": [
                "Open your UPI app — Google Pay, PhonePe, Paytm, or BHIM.",
                "Tap 'Send' or 'Pay Contacts' and pick the person or enter their UPI ID.",
                "Type the amount and a short note like 'rent' or 'lunch'.",
                "Tap Pay and enter your UPI PIN to confirm — that PIN stays private.",
                "Wait for the green tick and save the reference number if it's important.",
            ],
            "receive_money": [
                "Share your UPI ID — it looks like yourname at okhdfcbank or yourname at ybl.",
                "Or show your UPI QR code from the 'Receive' section of your app.",
                "The sender types the amount and pays — you'll get an instant notification.",
                "Check your app or SMS for the credit confirmation.",
            ],
            "setup_upi": [
                "Download a UPI app: Google Pay, PhonePe, Paytm, or the official BHIM app.",
                "Sign up using the mobile number that's linked to your bank account.",
                "Grant SMS permission — the app verifies you by sending a silent SMS.",
                "Choose your bank from the list and pick the account to link.",
                "Set your UPI PIN using your ATM debit card details — keep this PIN secret forever.",
            ],
            "pay_qr": [
                "Open your UPI app and tap 'Scan QR' or the camera icon.",
                "Point your phone at the merchant's QR code.",
                "Confirm the merchant name shown on screen matches the shop.",
                "Enter the amount, tap Pay, and enter your UPI PIN.",
                "Show the green tick to the shopkeeper as proof of payment.",
            ],
            "link_bank": [
                "In your UPI app, go to Profile or Settings and tap 'Bank Accounts'.",
                "Tap 'Add Bank Account' and pick your bank from the list.",
                "The app fetches accounts linked to your mobile number automatically.",
                "Set a UPI PIN using your debit card's last six digits and expiry.",
                "Your account is now UPI-ready.",
            ],
            "reset_pin": [
                "Open your UPI app and go to the bank account you want to reset.",
                "Tap 'Forgot UPI PIN' or 'Reset UPI PIN'.",
                "Enter your debit card's last six digits and expiry date.",
                "You'll get an OTP on your registered mobile — enter it in the app only, never share it.",
                "Set a new six-digit UPI PIN. Do not use birthdays or 1-2-3-4-5-6.",
            ],
            "collect_request": [
                "A collect request is when someone ASKS you to pay them.",
                "Be very careful — scammers use this to trick you into paying instead of receiving.",
                "If you didn't ask anyone to send you money, REJECT the request.",
                "Remember: you never need to enter a PIN to RECEIVE money — only to send it.",
            ],
            "refund_status": [
                "Open your UPI app and go to 'History' or 'Transactions'.",
                "Tap the failed or refunded transaction.",
                "You'll see a status: refunded, pending, or under dispute.",
                "Refunds usually reflect within three working days.",
                "If it's stuck beyond that, raise a complaint from the same screen or call 1800-120-1740, the NPCI helpline.",
            ],
        }
        # Scenario matching via whole-word keyword scoring (avoids substring
        # false positives like "received" incorrectly matching "receive").
        text = f" {scenario.lower().strip()} "
        keyword_map = {
            "send_money": ["send", "transfer", "pay someone", "pay a friend"],
            "receive_money": ["receive", "get paid", "collect money", "share upi id"],
            "setup_upi": [
                "setup",
                "set up",
                "create upi",
                "new upi",
                "activate upi",
                "start upi",
            ],
            "pay_qr": ["qr", "scan"],
            "link_bank": ["link", "add bank", "add account"],
            "reset_pin": ["reset", "forgot", "forgotten", "change pin"],
            "collect_request": ["collect request", "collect scam", "fake request"],
            "refund_status": [
                "refund",
                "failed transaction",
                "money not credited",
                "reversal",
                "debited but",
                "deducted but",
                "not received",
                "did not receive",
                "didn't receive",
                "money stuck",
            ],
        }
        exact_key = scenario.lower().strip().replace(" ", "_").replace("-", "_")
        if exact_key in guides:
            matched = exact_key
        else:
            scores = {
                name: sum(1 for kw in kws if re.search(rf"\b{re.escape(kw)}\b", text))
                for name, kws in keyword_map.items()
            }
            best = max(scores, key=lambda k: scores[k])
            matched = best if scores[best] > 0 else "send_money"

        logger.info("tool upi_guide requested=%r matched=%s", scenario, matched)
        return {
            "scenario": matched,
            "steps": guides[matched],
            "safety_reminder": "Never share your UPI PIN or OTP with anyone. VoicePay will never ask for them.",
        }

    @function_tool
    async def scheme_info(
        self, context: RunContext, scheme_name: str
    ) -> dict[str, Any]:
        """Look up an Indian government financial scheme.

        Args:
            scheme_name: Free-form name, e.g. 'PM-KISAN', 'Jan Dhan',
                'Sukanya Samriddhi', 'APY', 'PMJJBY', 'Mudra', 'PMAY'.

        Returns eligibility, benefits, and how to apply. Speak concisely.
        """
        self.stats.bump_tool("scheme_info")
        schemes = {
            "pm-kisan": {
                "name": "PM-KISAN Samman Nidhi",
                "who": "Small and marginal farmer families with cultivable land.",
                "benefit": "6000 rupees per year, paid in three equal instalments directly to the bank account.",
                "apply": "Visit pmkisan.gov.in, your nearest Common Service Centre, or the local agriculture office with Aadhaar, land records, and bank details.",
            },
            "pmjdy": {
                "name": "Pradhan Mantri Jan Dhan Yojana",
                "who": "Any Indian citizen without a bank account.",
                "benefit": "Zero-balance savings account, free RuPay debit card, 2 lakh accident insurance, and 10,000 rupees overdraft after six months of good conduct.",
                "apply": "Walk into any public sector bank branch with Aadhaar and one photo. Account opens the same day.",
            },
            "pmjjby": {
                "name": "Pradhan Mantri Jeevan Jyoti Bima Yojana",
                "who": "Anyone aged 18 to 50 with a bank account.",
                "benefit": "2 lakh life insurance cover for a premium of just 436 rupees per year, auto-debited from your account.",
                "apply": "Enrol through your bank's netbanking, mobile app, or branch.",
            },
            "pmsby": {
                "name": "Pradhan Mantri Suraksha Bima Yojana",
                "who": "Anyone aged 18 to 70 with a bank account.",
                "benefit": "2 lakh accident insurance cover for just 20 rupees per year.",
                "apply": "Enrol through your bank — takes two minutes.",
            },
            "apy": {
                "name": "Atal Pension Yojana",
                "who": "Any Indian aged 18 to 40 with a bank account.",
                "benefit": "Guaranteed monthly pension between 1000 and 5000 rupees after age 60. Contribution depends on entry age and pension chosen.",
                "apply": "Fill the APY form at your bank branch or via netbanking.",
            },
            "ssy": {
                "name": "Sukanya Samriddhi Yojana",
                "who": "Parents or legal guardians of a girl child below 10 years.",
                "benefit": "One of the highest tax-free interest rates for small savings — around 8 percent, revised quarterly. Matures when the girl turns 21.",
                "apply": "Open at any post office or authorised bank with the girl's birth certificate, guardian's KYC, and a minimum 250 rupees deposit.",
            },
            "pmay": {
                "name": "Pradhan Mantri Awas Yojana",
                "who": "Households without a pucca house — separate schemes for urban and rural.",
                "benefit": "Interest subsidy on home loans and direct construction assistance. Amounts vary by income category.",
                "apply": "Urban: pmaymis.gov.in. Rural: through the Gram Panchayat or block office.",
            },
            "mudra": {
                "name": "Pradhan Mantri Mudra Yojana",
                "who": "Small non-corporate, non-farm entrepreneurs — shopkeepers, vendors, artisans.",
                "benefit": "Collateral-free business loans up to 10 lakh rupees under three categories: Shishu up to 50000, Kishore up to 5 lakh, Tarun up to 10 lakh.",
                "apply": "Approach any public or private bank, NBFC, or MFI with your business plan and KYC.",
            },
        }

        # Normalize to hyphen-free lowercase alnum for robust fuzzy matching.
        key = re.sub(r"[^a-z]", "", scheme_name.lower())
        aliases = {
            "pmkisan": "pmkisan",
            "kisan": "pmkisan",
            "kissan": "pmkisan",
            "jandhan": "pmjdy",
            "jandhanyojana": "pmjdy",
            "jeevanjyoti": "pmjjby",
            "lifeinsurance": "pmjjby",
            "surakshabima": "pmsby",
            "accidentinsurance": "pmsby",
            "atalpension": "apy",
            "pension": "apy",
            "sukanya": "ssy",
            "sukanyasamriddhi": "ssy",
            "girlchild": "ssy",
            "awas": "pmay",
            "housing": "pmay",
            "home": "pmay",
            "mudrayojana": "mudra",
            "smallbusiness": "mudra",
            "loan": "mudra",
        }
        target = aliases.get(key, key)  # already hyphen-free
        matched = None
        for k in schemes:
            k_norm = k.replace("-", "")  # e.g. "pm-kisan" -> "pmkisan"
            if target == k_norm or target in k_norm or k_norm in target:
                matched = k
                break

        if matched is None:
            logger.info("tool scheme_info UNKNOWN requested=%r", scheme_name)
            return {
                "error": "unknown_scheme",
                "message": f"I don't have details on '{scheme_name}' handy. I can help with PM-KISAN, Jan Dhan, PMJJBY, PMSBY, Atal Pension, Sukanya Samriddhi, PMAY, or Mudra.",
                "known": list(schemes.keys()),
            }

        logger.info("tool scheme_info matched=%s", matched)
        info = schemes[matched]
        return {"scheme_key": matched, **info}


# =============================================================================
# SERVER + SESSION WIRING
# =============================================================================
server = AgentServer()


def prewarm(proc: JobProcess) -> None:
    """Prewarm heavy models in the worker process to slash cold-start latency."""
    proc.userdata["vad"] = silero.VAD.load()
    logger.info("prewarm complete — Silero VAD loaded")


server.setup_fnc = prewarm


@server.rtc_session(agent_name="voicepay")
async def voicepay_session(ctx: JobContext) -> None:
    """Handler invoked by LiveKit for every incoming voice session."""
    stats = SessionStats(room=ctx.room.name)

    # Structured log fields propagate to every log line in this session.
    ctx.log_context_fields = {
        "room": ctx.room.name,
        "agent": "voicepay",
        "track": "financial-services",
    }
    logger.info("session starting room=%s", ctx.room.name)

    # -------------------------------------------------------------------
    # Connect first so room metadata is synced from LiveKit Cloud.
    # The token API embeds voice selection as room config metadata.
    # -------------------------------------------------------------------
    await ctx.connect()
    logger.info("connected to room=%s — reading metadata", ctx.room.name)

    # -------------------------------------------------------------------
    # Resolve voice persona from room metadata
    # -------------------------------------------------------------------
    import json as _json

    persona_id: str | None = None

    def _try_parse_voice(raw: str | None) -> str | None:
        """Attempt to extract voice ID from JSON metadata string."""
        if not raw:
            return None
        try:
            obj = _json.loads(raw)
            return obj.get("voice")
        except (ValueError, TypeError):
            return None

    # Try room metadata (set via RoomConfiguration in token)
    persona_id = _try_parse_voice(ctx.room.metadata)
    if persona_id:
        logger.info("voice from room.metadata: %s", persona_id)

    # Fallback: check job metadata
    if not persona_id:
        try:
            job_meta = getattr(ctx.job, "metadata", None) or getattr(ctx, "metadata", None)
            persona_id = _try_parse_voice(job_meta)
            if persona_id:
                logger.info("voice from job metadata: %s", persona_id)
        except Exception:
            pass

    if not persona_id:
        logger.info("no voice selection found — using default persona")

    persona = get_persona(persona_id)
    logger.info(
        "resolved persona=%s voice=%s locale=%s",
        persona["name_display"],
        persona["voice"],
        persona["locale"],
    )

    # -------------------------------------------------------------------
    # Pipeline construction
    #   STT: Deepgram Nova-3   — strong Indian English + Hindi accuracy
    #   LLM: Gemini Flash Lite — fast, cheap, solid Hinglish
    #   TTS: Murf Falcon-2     — DYNAMIC voice from selected persona
    # -------------------------------------------------------------------
    session = AgentSession(
        stt=deepgram.STT(
            model="nova-3",
            language="multi",  # allow Hindi/English code-mixing
            smart_format=True,
        ),
        # Google Gemini — direct connection, ~200-400ms TTFT, great for voice
        # Credentials loaded from env: GOOGLE_API_KEY
        llm=google.LLM(
            model=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash-lite"),
            temperature=0.6,
        ),
        # Murf Falcon-2 — dynamic voice based on user's persona selection
        tts=murf.TTS(
            voice=persona["voice"],
            style=persona["style"],
            model="falcon-2",
            sample_rate=48000,
            locale=persona["locale"],
            speed=0,
            pitch=0,
            tokenizer=tokenize.basic.SentenceTokenizer(min_sentence_len=2),
            text_pacing=True,
        ),
        turn_detection=MultilingualModel(),
        vad=ctx.proc.userdata["vad"],
        # Kick off LLM generation while the user is still finishing their
        # sentence — biggest single win for perceived latency.
        preemptive_generation=True,
    )

    # -------------------------------------------------------------------
    # Metrics wiring — latency + usage
    # -------------------------------------------------------------------
    usage = metrics.UsageCollector()

    @session.on("metrics_collected")
    def _on_metrics(ev: Any) -> None:
        """Capture per-component metrics into our session stats + log them."""
        try:
            m = ev.metrics
            metrics.log_metrics(m)
            usage.collect(m)

            if isinstance(m, EOUMetrics):
                stats.current.eou_delay_ms = float(m.end_of_utterance_delay) * 1000
            elif isinstance(m, LLMMetrics):
                if getattr(m, "ttft", None) is not None:
                    stats.current.llm_ttft_ms = float(m.ttft) * 1000
            elif isinstance(m, TTSMetrics):
                if getattr(m, "ttfb", None) is not None:
                    stats.current.tts_ttfb_ms = float(m.ttfb) * 1000
                    # TTS TTFB is the last measurable hop before audio hits the
                    # user's ear — a good moment to finalise the turn snapshot.
                    stats.commit_turn()
                    last = stats.latencies[-1] if stats.latencies else None
                    if last and last.total_ms:
                        logger.info(
                            "TURN LATENCY eou=%.0fms llm_ttft=%.0fms tts_ttfb=%.0fms total=%.0fms",
                            last.eou_delay_ms or 0,
                            last.llm_ttft_ms or 0,
                            last.tts_ttfb_ms or 0,
                            last.total_ms,
                        )
            elif isinstance(m, STTMetrics):
                pass  # STT is streaming — no single-shot latency to report.
        except Exception:
            logger.exception("metrics handler crashed")

    # Turn counters
    @session.on("user_input_transcribed")
    def _on_user_input(ev: Any) -> None:
        if getattr(ev, "is_final", False):
            stats.user_turns += 1
            transcript = getattr(ev, "transcript", "") or ""
            logger.info("user: %s", transcript[:160])
            # Best-effort security guardrail: catch obvious OTP/PIN oversharing
            # even before the LLM sees it. The LLM will also refuse, but this
            # gives us a metric and a fast log signal.
            digits = re.findall(r"\b\d{4,8}\b", transcript)
            keywords = ("otp", "pin", "cvv", "password", "one time password")
            if digits and any(k in transcript.lower() for k in keywords):
                stats.security_blocks += 1
                logger.warning(
                    "SECURITY: potential credential in user input — LLM will refuse"
                )

    @session.on("agent_state_changed")
    def _on_agent_state(ev: Any) -> None:
        new_state = getattr(ev, "new_state", None)
        if new_state == "speaking":
            stats.agent_turns += 1

    # -------------------------------------------------------------------
    # In-session voice switch via data channel
    # The frontend sends JSON: {"type": "voice_switch", "voice": "samar"}
    # We hot-swap the TTS plugin on the live session.
    #
    # DataPacket signature: (data: bytes, kind, participant, topic)
    # -------------------------------------------------------------------
    @ctx.room.on("data_received")
    def _on_data(data_packet: Any) -> None:
        try:
            # DataPacket has positional fields: data, kind, participant, topic
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
                logger.warning("voice_switch: unknown voice=%s — ignoring", new_voice_id)
                return

            new_persona = VOICE_PERSONAS[new_voice_id]
            logger.info(
                "VOICE SWITCH mid-session: %s → %s",
                persona["name_display"],
                new_persona["name_display"],
            )

            # Hot-swap the TTS on the running session
            new_tts = murf.TTS(
                voice=new_persona["voice"],
                style=new_persona["style"],
                model="falcon-2",
                sample_rate=48000,
                locale=new_persona["locale"],
                speed=0,
                pitch=0,
                tokenizer=tokenize.basic.SentenceTokenizer(min_sentence_len=2),
                text_pacing=True,
            )
            # Direct internal attribute swap — session.tts property is read-only
            session._tts = new_tts

            # Update the agent's system prompt to match new persona personality
            new_prompt = build_system_prompt(new_persona)
            if session.current_agent:
                session.current_agent._instructions = new_prompt

            logger.info("voice switch complete — now speaking as %s", new_persona["name_display"])
        except Exception as exc:
            logger.debug("data_received: parse error or non-voice msg — %s", exc)

    # -------------------------------------------------------------------
    # Session shutdown hook — dump the transcript & stats for evaluation
    # -------------------------------------------------------------------
    async def _log_session_summary() -> None:
        summary = stats.summary()
        logger.info("=" * 60)
        logger.info("SESSION SUMMARY  room=%s", summary["room"])
        logger.info("  duration       : %.1fs", summary["duration_s"])
        logger.info("  user turns     : %d", summary["user_turns"])
        logger.info("  agent turns    : %d", summary["agent_turns"])
        logger.info("  tool calls     : %s", summary["tool_calls"] or "none")
        logger.info("  tool errors    : %d", summary["tool_errors"])
        logger.info("  security blocks: %d", summary["security_blocks"])
        logger.info(
            "  latency (ms)   : avg=%s p95=%s over %d turns",
            summary["avg_latency_ms"],
            summary["p95_latency_ms"],
            summary["turns_measured"],
        )
        try:
            u = usage.get_summary()
            logger.info("  usage          : %s", u)
        except Exception:
            pass
        logger.info("=" * 60)

    ctx.add_shutdown_callback(_log_session_summary)

    # -------------------------------------------------------------------
    # Start the pipeline
    # -------------------------------------------------------------------
    try:
        await session.start(
            agent=VoicePayAgent(stats=stats, persona=persona),
            room=ctx.room,
            room_options=room_io.RoomOptions(
                audio_input=room_io.AudioInputOptions(
                    # BVCTelephony for narrow-band SIP calls, BVC for WebRTC.
                    noise_cancellation=lambda params: (
                        noise_cancellation.BVCTelephony()
                        if params.participant.kind
                        == rtc.ParticipantKind.PARTICIPANT_KIND_SIP
                        else noise_cancellation.BVC()
                    ),
                ),
            ),
        )

        logger.info("session started — VoicePay is live in room=%s as %s", ctx.room.name, persona["name_display"])

    except asyncio.CancelledError:
        logger.info("session cancelled — shutting down gracefully")
        raise
    except Exception:
        logger.exception("session startup failed")
        raise


# =============================================================================
# ENTRYPOINT
# =============================================================================
if __name__ == "__main__":
    cli.run_app(server)
