"""
CalculatorAgent — Financial computation specialist.
====================================================
Owns: EMI calculation, loan eligibility, FD comparison, financial reasoning.
Voice tuning: speaks 10% slower for number clarity.
"""

from __future__ import annotations

import logging
import math
import re
from datetime import datetime
from typing import Any

from livekit.agents import RunContext, function_tool

from agents.base import BaseVoicePayAgent

logger = logging.getLogger("voicepay.agents.calculator")


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


CALCULATOR_PROMPT = """
# ABSOLUTE RULE — HINDI MUST BE IN DEVANAGARI SCRIPT — NO EXCEPTIONS

# IDENTITY
You are the Financial Calculator specialist at VoicePay. You are an EXPERT
at computing loan EMIs, checking loan eligibility, comparing FD rates across
banks, and reasoning through complex financial questions.

# YOUR CAPABILITIES
You have 4 powerful tools:
1. emi_calculator — compute monthly EMI for any loan
2. loan_eligibility — estimate max loan based on income (FOIR rules)
3. fd_rate_comparison — compare FD rates across 7 major banks
4. financial_reasoning — think through complex comparisons

# MANDATORY BEHAVIOR
- If user mentions ANY loan amount + tenure → CALL emi_calculator IMMEDIATELY
  - If rate not mentioned: personal 12%, home 8.5%, car 9%, education 10%, gold 8%
- If user asks "how much loan can I get" → CALL loan_eligibility
- If user asks about FD/fixed deposit → CALL fd_rate_comparison
- If user asks a complex "should I...?" question → CALL financial_reasoning
- NEVER say "I can't calculate" — YOU HAVE TOOLS. USE THEM.

# AFTER COMPUTING
- Always speak the key number naturally: "Your monthly EMI would be eight thousand five hundred rupees"
- Show a visual card with the full breakdown
- Ask ONE follow-up: "Want me to check something else, or shall I connect you back?"
- When done, call return_to_triage with a summary of what you computed

# STYLE
- Speak numbers clearly and naturally
- Break complex results into 2-3 short sentences
- Use acknowledgment starters: "Right.", "Sure thing.", "Let me compute that."
- Mirror user's language (Hindi → Devanagari)
- Max 20 words per sentence for TTS clarity

# SCOPE BOUNDARY
You ONLY handle calculations and financial comparisons.
If user asks about schemes, balance, UPI, or escalation → call return_to_triage.
"""


class CalculatorAgent(BaseVoicePayAgent):
    """Financial computation specialist — EMI, loans, FD, reasoning."""

    AGENT_NAME = "calculator"

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(instructions=CALCULATOR_PROMPT, **kwargs)

    async def on_enter(self) -> None:
        """Announce arrival as calculator specialist."""
        await super().on_enter()
        # Don't speak a greeting if this is the first handoff (triage already spoke)
        # Just acknowledge the routing silently — the LLM will respond to the user's
        # actual question on the next turn.

    # ------------------------------------------------------------------
    # EMI Calculator
    # ------------------------------------------------------------------
    @function_tool
    async def emi_calculator(
        self,
        context: RunContext,
        principal: float,
        annual_rate_percent: float,
        tenure_months: int,
    ) -> dict[str, Any]:
        """Calculate the monthly EMI for a loan. ALWAYS call this when user
        mentions any loan amount, even if they don't give all parameters.

        Args:
            principal: Loan amount in rupees (e.g. 300000 for 3 lakhs).
            annual_rate_percent: Annual interest rate percent (e.g. 8.5).
                Defaults: personal 12%, home 8.5%, car 9%, education 10%, gold 8%.
            tenure_months: Duration in months (e.g. 12 for 1 year, 60 for 5 years).
        """
        self.state.bump_tool("emi_calculator")
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

            logger.info("emi_calculator: p=%.0f r=%.2f n=%d emi=%.0f", p, annual, n, emi)

            result = {
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

            # Persist in state for cross-specialist access
            self.state.last_emi_result = result
            self.state.computed_values["last_emi"] = {
                "principal": p,
                "rate": annual,
                "tenure": n,
                "emi": round(emi, 2),
            }

            # Push visual card
            canvas_data = {
                "monthly_emi": round(emi, 2),
                "principal": p,
                "interest": round(total_interest, 2),
                "total_payable": round(total_payable, 2),
                "tenure_months": n,
                "loan_amount": p,
                "interest_rate": annual,
            }
            await self._push_visual("emi", canvas_data)
            return result
        except Exception as e:
            self.state.tool_errors += 1
            logger.exception("emi_calculator failed")
            return {
                "error": str(e),
                "message": "I need the loan amount, interest rate, and tenure to calculate EMI.",
            }

    # ------------------------------------------------------------------
    # Loan Eligibility
    # ------------------------------------------------------------------
    @function_tool
    async def loan_eligibility(
        self,
        context: RunContext,
        monthly_income: float,
        existing_emi: float = 0,
        loan_type: str = "home",
        desired_amount: float | None = None,
        tenure_months: int | None = None,
        interest_rate: float | None = None,
    ) -> str:
        """Estimate maximum eligible loan amount based on income using FOIR rules.

        Call when user asks "how much loan can I get", "kitna loan milega",
        "am I eligible for loan", "EMI on my salary".

        Args:
            monthly_income: Gross monthly income in rupees.
            existing_emi: Total existing EMI per month (default 0).
            loan_type: 'home', 'personal', 'car', 'education', 'gold', 'business'.
            desired_amount: Specific loan amount wanted (optional).
            tenure_months: Tenure in months (optional, uses default for type).
            interest_rate: Annual rate percent (optional, uses default).
        """
        self.state.bump_tool("loan_eligibility")
        try:
            from tools_day5 import estimate_loan_eligibility

            result = await estimate_loan_eligibility(
                monthly_income=monthly_income,
                existing_emi=existing_emi,
                loan_type=loan_type,
                desired_amount=desired_amount,
                tenure_months=tenure_months,
                interest_rate=interest_rate,
            )
            self.state.last_eligibility_result = {"result": result, "loan_type": loan_type}
            await self._push_visual(
                "loan_eligibility",
                {
                    "title": f"Loan Eligibility — {loan_type.title()}",
                    "monthly_income": monthly_income,
                    "loan_type": loan_type,
                    "result_text": result[:600],
                },
            )
            return result
        except Exception as e:
            self.state.tool_errors += 1
            logger.exception("loan_eligibility failed")
            return f"Error calculating loan eligibility: {e}"

    # ------------------------------------------------------------------
    # FD Rate Comparison
    # ------------------------------------------------------------------
    @function_tool
    async def fd_rate_comparison(
        self,
        context: RunContext,
        tenure_months: int = 12,
        amount: float = 100000,
        is_senior_citizen: bool = False,
    ) -> str:
        """Compare Fixed Deposit rates across SBI, HDFC, ICICI, Axis, Kotak, PNB, Bank of Baroda.

        Call when user asks about 'FD rate', 'fixed deposit', 'best FD',
        'which bank gives best interest', 'FD mein kitna milega'.

        Args:
            tenure_months: FD tenure in months (1-120). Default 12.
            amount: Deposit amount in rupees. Default 1 lakh.
            is_senior_citizen: Whether depositor is 60+ (extra 0.25-0.50%).
        """
        self.state.bump_tool("fd_rate_comparison")
        try:
            from tools_day5 import compare_fd_rates

            result = await compare_fd_rates(
                tenure_months=tenure_months,
                amount=amount,
                is_senior_citizen=is_senior_citizen,
            )
            await self._push_visual(
                "fd_comparison",
                {
                    "title": "FD Rate Comparison",
                    "tenure_months": tenure_months,
                    "amount": amount,
                    "senior": is_senior_citizen,
                    "result_text": result[:600],
                },
            )
            return result
        except Exception as e:
            self.state.tool_errors += 1
            logger.exception("fd_rate_comparison failed")
            return f"Error comparing FD rates: {e}"

    # ------------------------------------------------------------------
    # Financial Reasoning (deep thinking)
    # ------------------------------------------------------------------
    @function_tool
    async def financial_reasoning(
        self,
        context: RunContext,
        question: str,
        user_context: str = "",
    ) -> dict[str, Any]:
        """Use deep reasoning for complex financial questions.

        Call when user asks "should I break FD for mutual fund?", "FD vs SIP?",
        tax planning, investment allocation, or multi-factor comparisons.

        Args:
            question: The user's financial question needing analytical thinking.
            user_context: Relevant context (age, income bracket, goals).
        """
        self.state.bump_tool("financial_reasoning")
        logger.info("financial_reasoning: q=%s", question[:80])
        return {
            "reasoning_framework": {
                "question": question,
                "context": user_context,
                "instructions_for_agent": (
                    "Think through this step-by-step using Indian financial fundamentals. "
                    "Consider: risk tolerance, time horizon, tax implications under Indian law, "
                    "liquidity needs, inflation (6-7%), opportunity cost. "
                    "Give a FRAMEWORK, not a directive. Keep under 5 spoken sentences. "
                    "End with: 'For a personalised plan, consult a SEBI-registered advisor.'"
                ),
            },
            "disclaimer": "General educational guidance, not personalised financial advice.",
        }
