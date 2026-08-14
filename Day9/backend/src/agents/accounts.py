"""
AccountsAgent — Account info, transactions, UPI, memory specialist.
====================================================================
Owns: balance_check, transaction_history, upi_guide, remember_user_info,
save_conversation_topic.
"""

from __future__ import annotations

import logging
import random
import re
import time
from datetime import datetime, timedelta
from typing import Any

from livekit.agents import RunContext, function_tool

from agents.base import BaseVoicePayAgent

logger = logging.getLogger("voicepay.agents.accounts")


def _spoken_inr(amount: float) -> str:
    a = round(amount)
    if a >= 10_000_000:
        return f"{a / 10_000_000:.2f} crore rupees"
    if a >= 100_000:
        return f"{a / 100_000:.2f} lakh rupees"
    if a >= 1_000:
        return f"{a / 1_000:.1f} thousand rupees"
    return f"{a} rupees"


def _fmt_inr(amount: float) -> str:
    rupees, paise = divmod(round(amount * 100), 100)
    s = str(int(rupees))
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        head = re.sub(r"(\d)(?=(\d\d)+$)", r"\1,", head)
        s = f"{head},{tail}"
    return f"₹{s}.{paise:02d}"


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


ACCOUNTS_PROMPT = """
# ABSOLUTE RULE — HINDI MUST BE IN DEVANAGARI SCRIPT

# IDENTITY
You are the Accounts & UPI specialist at VoicePay. You help with:
- Checking account balance (demo data — you must say so)
- Reviewing recent transactions
- Walking through UPI scenarios (send, receive, setup, reset PIN, scam warnings)
- Saving user preferences with consent

# YOUR CAPABILITIES
1. balance_check — show demo account balance
2. transaction_history — recent demo transactions
3. upi_guide — step-by-step UPI walkthroughs
4. remember_user_info — save name + preferences (ASK PERMISSION FIRST)
5. save_conversation_topic — save a session summary (ASK PERMISSION)

# MANDATORY BEHAVIOR
- Always say "This is demo data" when showing balance/transactions
- For UPI questions → CALL upi_guide with the right scenario
- Before saving ANYTHING → ASK PERMISSION EXPLICITLY
- If user says NO → do NOT save. Drop it.

# MEMORY RULES (STRICT)
- ASK BEFORE SAVING: "Main aapka naam yaad rakh loon next time ke liye?"
- NEVER store: account numbers, Aadhaar, PAN, OTP, PIN, CVV, passwords
- If user says "forget me" → call return_to_triage (Security specialist handles that)

# SCOPE
You ONLY handle balance, transactions, UPI, saving prefs.
For loans/EMI, schemes, fraud, escalation → call return_to_triage.

# STYLE
- Warm, patient — this is often user's first banking conversation
- Speak numbers naturally
- Break UPI steps into 2 at a time, then ask "Ready for next?"
"""


class AccountsAgent(BaseVoicePayAgent):
    """Account info, transactions, UPI, and memory specialist."""

    AGENT_NAME = "accounts"

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(instructions=ACCOUNTS_PROMPT, **kwargs)

    async def on_enter(self) -> None:
        await super().on_enter()

    @function_tool
    async def balance_check(
        self, context: RunContext, account_type: str = "savings"
    ) -> dict[str, Any]:
        """Check the demo account balance for the current user.

        Args:
            account_type: One of 'savings', 'current', 'salary'.
        """
        self.state.bump_tool("balance_check")
        try:
            balances = {"savings": 42_318.75, "current": 1_28_450.00, "salary": 87_612.30}
            key = account_type.lower().strip()
            if key not in balances:
                key = "savings"
            amount = balances[key]
            logger.info("balance_check account=%s amount=%s", key, amount)
            result = {
                "account_type": key,
                "balance_inr": amount,
                "balance_spoken": _spoken_inr(amount),
                "balance_formatted": _fmt_inr(amount),
                "as_of": datetime.now().strftime("%d %b %Y, %I:%M %p"),
                "demo": True,
            }
            await self._push_visual("balance", result)
            return result
        except Exception as e:
            self.state.tool_errors += 1
            logger.exception("balance_check failed")
            return {"error": str(e), "message": "I couldn't fetch your balance right now."}

    @function_tool
    async def transaction_history(
        self, context: RunContext, days: int = 7, count: int = 5
    ) -> dict[str, Any]:
        """Return recent transactions from the demo account.

        Args:
            days: Look-back window (default 7, max 90).
            count: How many to return (default 5, max 10).
        """
        self.state.bump_tool("transaction_history")
        try:
            days = max(1, min(int(days), 90))
            count = max(1, min(int(count), 10))
            rng = random.Random(hash(self.state.room_name) & 0xFFFF)
            picks = rng.sample(_DEMO_TRANSACTIONS, min(count, len(_DEMO_TRANSACTIONS)))
            now = datetime.now()
            txns = []
            for merchant, amount, rail in picks:
                ts = now - timedelta(days=rng.randint(0, days), hours=rng.randint(0, 23))
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
            result = {"window_days": days, "transactions": txns, "demo": True}
            await self._push_visual("table", result)
            return result
        except Exception as e:
            self.state.tool_errors += 1
            logger.exception("transaction_history failed")
            return {"error": str(e), "message": "I couldn't pull your transactions."}

    @function_tool
    async def upi_guide(self, context: RunContext, scenario: str) -> dict[str, Any]:
        """Step-by-step UPI walkthrough for a common scenario.

        Args:
            scenario: One of 'send_money', 'receive_money', 'setup_upi', 'pay_qr',
                'link_bank', 'reset_pin', 'collect_request', 'refund_status'.
        """
        self.state.bump_tool("upi_guide")
        guides = {
            "send_money": [
                "Open your UPI app — Google Pay, PhonePe, Paytm, or BHIM.",
                "Tap 'Send' and pick the person or enter their UPI ID.",
                "Type the amount and a short note like 'rent' or 'lunch'.",
                "Tap Pay and enter your UPI PIN to confirm — that PIN stays private.",
                "Wait for the green tick and save the reference number if important.",
            ],
            "receive_money": [
                "Share your UPI ID like yourname at okhdfcbank or yourname at ybl.",
                "Or show your UPI QR code from the 'Receive' section.",
                "The sender types the amount and pays — instant notification.",
                "Check your app or SMS for the credit confirmation.",
            ],
            "setup_upi": [
                "Download a UPI app: Google Pay, PhonePe, Paytm, or BHIM.",
                "Sign up using the mobile number linked to your bank account.",
                "Grant SMS permission — the app verifies via silent SMS.",
                "Choose your bank and pick the account to link.",
                "Set your UPI PIN using your ATM card details — keep this PIN secret.",
            ],
            "pay_qr": [
                "Open your UPI app and tap 'Scan QR'.",
                "Point your phone at the merchant's QR code.",
                "Confirm the merchant name matches the shop.",
                "Enter the amount, tap Pay, and enter your UPI PIN.",
                "Show the green tick as proof of payment.",
            ],
            "link_bank": [
                "In your UPI app, go to Profile and tap 'Bank Accounts'.",
                "Tap 'Add Bank Account' and pick your bank.",
                "The app fetches accounts linked to your mobile number.",
                "Set a UPI PIN using your debit card details.",
                "Your account is now UPI-ready.",
            ],
            "reset_pin": [
                "Open your UPI app and select the bank account.",
                "Tap 'Forgot UPI PIN' or 'Reset UPI PIN'.",
                "Enter your debit card's last six digits and expiry.",
                "You'll get an OTP on your mobile — enter in the app only, NEVER share.",
                "Set a new six-digit UPI PIN. Avoid birthdays or 1-2-3-4-5-6.",
            ],
            "collect_request": [
                "A collect request is when someone ASKS you to pay them.",
                "Be very careful — scammers use this to trick you into paying instead of receiving.",
                "If you didn't ask anyone to send you money, REJECT the request.",
                "Remember: you never need a PIN to RECEIVE money — only to SEND.",
            ],
            "refund_status": [
                "Open your UPI app and go to 'History' or 'Transactions'.",
                "Tap the failed or refunded transaction.",
                "You'll see status: refunded, pending, or under dispute.",
                "Refunds usually reflect within three working days.",
                "If stuck beyond that, call NPCI 1800-120-1740, toll-free 24x7.",
            ],
        }
        text = f" {scenario.lower().strip()} "
        keyword_map = {
            "send_money": ["send", "transfer", "pay someone", "pay a friend"],
            "receive_money": ["receive", "get paid", "collect money", "share upi id"],
            "setup_upi": ["setup", "set up", "create upi", "new upi", "activate upi"],
            "pay_qr": ["qr", "scan"],
            "link_bank": ["link", "add bank", "add account"],
            "reset_pin": ["reset", "forgot", "forgotten", "change pin"],
            "collect_request": ["collect request", "collect scam", "fake request"],
            "refund_status": ["refund", "failed transaction", "money not credited", "money stuck"],
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

        logger.info("upi_guide requested=%r matched=%s", scenario, matched)
        result = {
            "scenario": matched,
            "steps": guides[matched],
            "safety_reminder": "Never share your UPI PIN or OTP. VoicePay will never ask for them.",
        }
        await self._push_visual("steps", result)
        return result

    @function_tool
    async def remember_user_info(
        self,
        context: RunContext,
        user_name: str,
        facts: str = "",
        language_preference: str = "",
    ) -> str:
        """Save information about the caller for future conversations.

        IMPORTANT: ASK PERMISSION FIRST. Only call after user says YES.

        Args:
            user_name: The caller's name.
            facts: Comma-separated facts. NEVER include: account numbers, Aadhaar,
                PAN, OTP, PIN, passwords, card numbers.
            language_preference: 'en', 'hi', 'hinglish'.
        """
        self.state.bump_tool("remember_user_info")

        if not self.state.user_id:
            return "No user identity available. Tell the user you cannot save right now."

        fact_dict: dict[str, str] = {}
        if facts:
            for i, fact in enumerate(facts.split(","), 1):
                fact = fact.strip()
                if not fact:
                    continue
                if any(w in fact.lower() for w in ["scheme", "yojana", "pm-"]):
                    fact_dict[f"scheme_interest_{i}"] = fact
                elif any(w in fact.lower() for w in ["invest", "mutual", "sip", "fd"]):
                    fact_dict[f"investment_interest_{i}"] = fact
                elif any(w in fact.lower() for w in ["loan", "emi", "credit"]):
                    fact_dict[f"loan_context_{i}"] = fact
                else:
                    fact_dict[f"personal_fact_{i}"] = fact

        # Security check
        sensitive_patterns = [
            r"\b\d{4}\s?\d{4}\s?\d{4}\b",
            r"\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b",
            r"\b[A-Z]{5}\d{4}[A-Z]\b",
            r"\b(otp|pin|cvv|password)\b",
        ]
        all_text = f"{user_name} {facts}".lower()
        for pat in sensitive_patterns:
            if re.search(pat, all_text, re.I):
                logger.warning("BLOCKED: sensitive data in memory save")
                return "BLOCKED: Cannot store sensitive info. Tell user for security reasons you can't save that."

        try:
            from memory import save_facts, save_user

            await save_user(
                user_id=self.state.user_id,
                name=user_name,
                language_pref=language_preference or self.state.language,
                persona_pref=self.state.persona_id,
                consent_given=True,
            )
            self.state.consent_given = True
            self.state.user_name = user_name

            if fact_dict:
                await save_facts(self.state.user_id, fact_dict)

            logger.info("remember_user_info: saved name=%s facts=%d", user_name, len(fact_dict))
            return (
                f"SUCCESS: Saved '{user_name}' with {len(fact_dict)} facts. "
                f"Tell user warmly you'll remember them next time."
            )
        except Exception as e:
            logger.exception("remember_user_info failed")
            return f"ERROR: {e}. Tell user there was a small issue, you'll try next time."

    @function_tool
    async def save_conversation_topic(
        self, context: RunContext, summary: str, topics: str = ""
    ) -> dict[str, Any]:
        """Save a brief summary of this conversation for future reference.

        IMPORTANT: Ask "Shall I save a note about what we discussed today?" first.

        Args:
            summary: 1-2 sentence summary.
            topics: Comma-separated topic tags.
        """
        self.state.bump_tool("save_conversation_topic")

        if not self.state.user_id:
            return {"saved": False, "reason": "No user identity"}

        if not self.state.consent_given:
            return {
                "saved": False,
                "reason": "No consent given. Ask first.",
                "instruction": "Ask: 'Shall I remember what we discussed?'",
            }

        try:
            from memory import save_conversation_summary

            topic_list = [t.strip() for t in topics.split(",") if t.strip()] if topics else []
            tools_list = list(self.state.tool_calls.keys())

            await save_conversation_summary(
                user_id=self.state.user_id,
                room_name=self.state.room_name,
                summary=summary,
                topics=topic_list,
                tools_used=tools_list,
                duration_s=int(time.time() - self.state.started_at),
            )
            logger.info("save_conversation_topic: user=%s", self.state.user_id)
            return {"saved": True, "summary": summary, "topics": topic_list}
        except Exception as e:
            logger.exception("save_conversation_topic failed")
            return {"saved": False, "error": str(e)}
