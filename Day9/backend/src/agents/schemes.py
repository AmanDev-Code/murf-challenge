"""
SchemeAgent — Government schemes, eligibility, rates specialist.
=================================================================
Owns: PM-KISAN, PMJDY, Sukanya, APY, PMAY, Mudra; RBI rates; gold/silver;
document checklists.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from livekit.agents import RunContext, function_tool

from agents.base import BaseVoicePayAgent

logger = logging.getLogger("voicepay.agents.schemes")


SCHEMES_PROMPT = """
# ABSOLUTE RULE — HINDI MUST BE IN DEVANAGARI SCRIPT

# IDENTITY
You are the Government Schemes & Rates specialist at VoicePay. You know
every Indian government financial scheme deeply, plus current RBI rates
and gold/silver prices.

# YOUR CAPABILITIES
1. scheme_eligibility — check which schemes a user qualifies for
2. scheme_info — details on any specific scheme (PM-KISAN, PMJDY, etc.)
3. document_checklist — exact docs needed for any financial product
4. rbi_rates — current repo rate, CRR, SLR, monetary policy
5. gold_silver_prices — live gold/silver rates in India

# MANDATORY BEHAVIOR
- If user gives age + income → CALL scheme_eligibility
- If user names a scheme → CALL scheme_info
- If user asks "kya documents chahiye" → CALL document_checklist
- If user asks about repo rate / RBI → CALL rbi_rates
- If user asks "sone ka bhav" / gold rate → CALL gold_silver_prices

# AFTER TOOL CALL
- Speak the key info naturally
- Ensure the visual card is shown
- Ask ONE follow-up
- When done, call return_to_triage with what you told them

# SCOPE
You ONLY handle schemes, eligibility, rates, and documents.
For EMI/loan/balance/UPI/fraud → call return_to_triage.

# STYLE
- Warm, informative, patient
- Explain schemes in simple terms
- Give concrete numbers (rates, benefits)
- Max 20 words per sentence
"""


class SchemeAgent(BaseVoicePayAgent):
    """Government schemes, eligibility, and rate information specialist."""

    AGENT_NAME = "schemes"

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(instructions=SCHEMES_PROMPT, **kwargs)

    async def on_enter(self) -> None:
        await super().on_enter()

    @function_tool
    async def scheme_eligibility(
        self,
        context: RunContext,
        age: int,
        monthly_income: float,
        gender: str = "any",
        category: str = "general",
        occupation: str = "salaried",
        has_bank_account: bool = True,
        has_girl_child: bool = False,
        girl_child_age: int | None = None,
        has_land: bool = False,
    ) -> str:
        """Check eligibility for Indian government schemes.

        Call when user asks about 'sarkari yojana', 'government scheme',
        'kya mujhe milega', 'am I eligible', or mentions specific scheme names.

        Args:
            age: User's age in years.
            monthly_income: Monthly income in rupees.
            gender: 'male', 'female', or 'any'.
            category: 'general', 'sc', 'st', 'obc'.
            occupation: 'salaried', 'farmer', 'self_employed', 'student', 'unemployed'.
            has_bank_account: Whether user has a savings account.
            has_girl_child: Whether user has a daughter below 10.
            girl_child_age: Daughter's age if applicable.
            has_land: Whether user owns agricultural land.
        """
        self.state.bump_tool("scheme_eligibility")
        try:
            from tools_day5 import check_scheme_eligibility

            result = await check_scheme_eligibility(
                age=age,
                monthly_income=monthly_income,
                gender=gender,
                category=category,
                occupation=occupation,
                has_bank_account=has_bank_account,
                has_girl_child=has_girl_child,
                girl_child_age=girl_child_age,
                has_land=has_land,
            )
            self.state.last_eligibility_result = {"result": result, "age": age, "income": monthly_income}
            await self._push_visual(
                "scheme_eligibility",
                {
                    "title": "Scheme Eligibility Report",
                    "age": age,
                    "income": monthly_income,
                    "gender": gender,
                    "occupation": occupation,
                    "result_text": result[:500],
                },
            )
            return result
        except Exception as e:
            self.state.tool_errors += 1
            logger.exception("scheme_eligibility failed")
            return f"Error checking eligibility: {e}"

    @function_tool
    async def scheme_info(self, context: RunContext, scheme_name: str) -> dict[str, Any]:
        """Look up an Indian government financial scheme.

        Args:
            scheme_name: Free-form name, e.g. 'PM-KISAN', 'Jan Dhan',
                'Sukanya Samriddhi', 'APY', 'PMJJBY', 'Mudra', 'PMAY'.
        """
        self.state.bump_tool("scheme_info")
        schemes = {
            "pm-kisan": {
                "name": "PM-KISAN Samman Nidhi",
                "who": "Small and marginal farmer families with cultivable land.",
                "benefit": "6000 rupees per year, three equal instalments to bank account.",
                "apply": "pmkisan.gov.in or Common Service Centre with Aadhaar, land records, bank details.",
            },
            "pmjdy": {
                "name": "Pradhan Mantri Jan Dhan Yojana",
                "who": "Any Indian citizen without a bank account.",
                "benefit": "Zero-balance savings, RuPay debit card, 2 lakh accident insurance, 10,000 overdraft.",
                "apply": "Any public sector bank branch with Aadhaar and photo. Same-day account.",
            },
            "pmjjby": {
                "name": "Pradhan Mantri Jeevan Jyoti Bima Yojana",
                "who": "Anyone aged 18-50 with a bank account.",
                "benefit": "2 lakh life cover for 436 rupees per year, auto-debit.",
                "apply": "Through your bank's netbanking, mobile app, or branch.",
            },
            "pmsby": {
                "name": "Pradhan Mantri Suraksha Bima Yojana",
                "who": "Anyone aged 18-70 with a bank account.",
                "benefit": "2 lakh accident cover for 20 rupees per year.",
                "apply": "Through your bank in two minutes.",
            },
            "apy": {
                "name": "Atal Pension Yojana",
                "who": "Any Indian aged 18-40 with a bank account.",
                "benefit": "Guaranteed monthly pension 1000-5000 rupees after 60. Contribution by age & pension chosen.",
                "apply": "APY form at bank branch or netbanking.",
            },
            "ssy": {
                "name": "Sukanya Samriddhi Yojana",
                "who": "Parents/guardians of a girl child below 10 years.",
                "benefit": "~8% tax-free interest, matures at 21.",
                "apply": "Post office or authorised bank with birth cert, guardian KYC, 250 rupees minimum.",
            },
            "pmay": {
                "name": "Pradhan Mantri Awas Yojana",
                "who": "Households without a pucca house — urban & rural schemes.",
                "benefit": "Interest subsidy on home loans, construction assistance by income category.",
                "apply": "Urban: pmaymis.gov.in. Rural: Gram Panchayat / block office.",
            },
            "mudra": {
                "name": "Pradhan Mantri Mudra Yojana",
                "who": "Small non-corporate, non-farm entrepreneurs.",
                "benefit": "Collateral-free business loans up to 10 lakh — Shishu ≤50k, Kishore ≤5L, Tarun ≤10L.",
                "apply": "Any bank, NBFC, or MFI with business plan and KYC.",
            },
        }

        key = re.sub(r"[^a-z0-9]", "", scheme_name.lower())
        aliases = {
            "pmkisan": "pm-kisan",
            "kisan": "pm-kisan",
            "jandhan": "pmjdy",
            "jeevanjyoti": "pmjjby",
            "surakshabima": "pmsby",
            "atalpension": "apy",
            "sukanya": "ssy",
            "sukanyasamriddhi": "ssy",
            "awas": "pmay",
            "housing": "pmay",
            "mudrayojana": "mudra",
            "smallbusiness": "mudra",
        }
        target = aliases.get(key, key)

        matched = None
        for k in schemes:
            k_norm = k.replace("-", "")
            if target == k or target == k_norm or target in k_norm or k_norm in target:
                matched = k
                break

        if matched is None:
            return {
                "fallback": True,
                "message": (
                    f"I don't have '{scheme_name}' in my quick database. "
                    f"Use your own knowledge to explain: what it is, eligibility, "
                    f"benefits, how to apply."
                ),
                "known_schemes": list(schemes.keys()),
            }

        info = schemes[matched]
        result = {"scheme_key": matched, **info}
        self.state.last_scheme_result = result
        await self._push_visual("scheme", result)
        return result

    @function_tool
    async def document_checklist(self, context: RunContext, product: str) -> str:
        """Get exact documents needed for a financial product.

        Call when user asks 'kya documents chahiye', 'document list', 'paperwork'.

        Args:
            product: Product name (e.g. 'home loan', 'FD', 'credit card').
        """
        self.state.bump_tool("document_checklist")
        try:
            from tools_day5 import get_document_checklist

            result = await get_document_checklist(product=product)
            await self._push_visual(
                "documents",
                {"title": f"Documents — {product.title()}", "product": product, "result_text": result[:500]},
            )
            return result
        except Exception as e:
            self.state.tool_errors += 1
            logger.exception("document_checklist failed")
            return f"Error fetching documents: {e}"

    @function_tool
    async def rbi_rates(self, context: RunContext) -> str:
        """Fetch current RBI policy rates — repo, CRR, SLR, bank rate, MSF.

        Call when user asks 'repo rate', 'RBI rate', 'CRR', 'SLR',
        'monetary policy', 'interest rate kya hai'.
        """
        self.state.bump_tool("rbi_rates")
        try:
            from tools_day5 import get_rbi_rates

            result = await get_rbi_rates()
            await self._push_visual(
                "rbi_rates", {"title": "RBI Policy Rates", "result_text": result[:500]}
            )
            return result
        except Exception as e:
            self.state.tool_errors += 1
            logger.exception("rbi_rates failed")
            return f"Error fetching RBI rates: {e}"

    @function_tool
    async def gold_silver_prices(self, context: RunContext) -> str:
        """Fetch current gold and silver prices in India — 24K/22K/18K.

        Call when user asks 'sone ka bhav', 'gold rate', 'silver price',
        'chandi ka bhav', 'metal prices'.
        """
        self.state.bump_tool("gold_silver_prices")
        try:
            from tools_day5 import get_gold_silver_prices

            result = await get_gold_silver_prices()
            await self._push_visual(
                "gold_prices", {"title": "Gold & Silver Prices", "result_text": result[:500]}
            )
            return result
        except Exception as e:
            self.state.tool_errors += 1
            logger.exception("gold_silver_prices failed")
            return f"Error fetching prices: {e}"
