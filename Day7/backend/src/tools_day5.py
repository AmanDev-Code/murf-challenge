"""
=============================================================================
 VoicePay — Day 5 Financial Tools
 Track:  Financial Services  |  #VoiceForBharat
=============================================================================

Production-grade tools for Indian financial services. Each function:
  - Returns a STRING (Gemini requires this to avoid empty responses)
  - Includes a data freshness timestamp
  - Has a 5-second timeout with graceful fallback
  - Validates all inputs and sanitises outputs
  - Reads API keys from environment variables only
  - Caches API responses for 30 seconds (rate limiting)

Import and register in agent.py:
    from tools_day5 import get_day5_tools
    # ... then in your Agent class, add as @function_tool methods

Or use the standalone functions directly — they are async and return str.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import ssl
import time
from datetime import datetime
from typing import Any

import certifi

logger = logging.getLogger("voicepay.tools")

# SSL context for aiohttp (macOS Python 3.13 fix)
_SSL_CTX = ssl.create_default_context(cafile=certifi.where())

# ---------------------------------------------------------------------------
# Local datasets — real eligibility criteria, rates, checklists
# ---------------------------------------------------------------------------
from tools_data import (
    DOCUMENT_CHECKLISTS,
    FD_RATES,
    FD_RATES_LAST_UPDATED,
    GOVERNMENT_SCHEMES,
    LOAN_PARAMS,
    METAL_PRICES_CACHE,
    RBI_RATES_CACHE,
)

# ---------------------------------------------------------------------------
# Rate-limiting cache: tool_name -> (timestamp, result_string)
# Max 1 API call per tool per 30 seconds.
# ---------------------------------------------------------------------------
_API_CACHE: dict[str, tuple[float, str]] = {}
_CACHE_TTL_SECONDS = 30


def _cache_get(key: str) -> str | None:
    """Return cached result if still fresh, else None."""
    entry = _API_CACHE.get(key)
    if entry and (time.time() - entry[0]) < _CACHE_TTL_SECONDS:
        return entry[1]
    return None


def _cache_set(key: str, value: str) -> None:
    """Store a result in the rate-limiting cache."""
    _API_CACHE[key] = (time.time(), value)


def _now_stamp() -> str:
    """Return a human-readable 'Data as of' timestamp."""
    return datetime.now().strftime("%d %b %Y, %I:%M %p")


def _sanitise(text: str) -> str:
    """Strip any accidental PII patterns from output text."""
    # Mask anything that looks like a 12-digit Aadhaar
    text = re.sub(r"\b\d{4}\s?\d{4}\s?\d{4}\b", "XXXX-XXXX-XXXX", text)
    # Mask PAN
    text = re.sub(r"\b[A-Z]{5}\d{4}[A-Z]\b", "XXXXX0000X", text)
    return text


def _fmt_inr(amount: float) -> str:
    """Format amount in Indian numbering (lakhs/crores)."""
    if amount >= 1_00_00_000:
        return f"Rs {amount / 1_00_00_000:,.2f} crore"
    if amount >= 1_00_000:
        return f"Rs {amount / 1_00_000:,.2f} lakh"
    if amount >= 1_000:
        return f"Rs {amount:,.0f}"
    return f"Rs {amount:.2f}"


# =============================================================================
# TOOL 1: SCHEME ELIGIBILITY CHECKER
# =============================================================================

async def check_scheme_eligibility(
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
    """Check eligibility for major Indian government schemes based on user details.

    Takes the user's age, monthly income, gender, category (general/SC/ST/OBC),
    occupation, and other details. Returns a clear eligibility report showing
    which schemes they qualify for and which they don't, with reasons.

    Args:
        age: User's age in years (18-100).
        monthly_income: User's monthly income in rupees.
        gender: 'male', 'female', or 'any'.
        category: 'general', 'sc', 'st', 'obc', or 'any'.
        occupation: 'salaried', 'farmer', 'self_employed', 'student', 'unemployed'.
        has_bank_account: Whether the user has a savings bank account.
        has_girl_child: Whether the user has a daughter below 10 years.
        girl_child_age: Age of the girl child (if applicable).
        has_land: Whether user owns agricultural land.

    Returns:
        A formatted string with eligibility results for all major schemes.
    """
    # --- Input validation ---
    age = max(0, min(int(age), 120))
    monthly_income = max(0.0, float(monthly_income))
    gender = gender.lower().strip() if gender else "any"
    category = category.lower().strip() if category else "general"
    occupation = occupation.lower().strip().replace(" ", "_") if occupation else "salaried"

    eligible: list[str] = []
    not_eligible: list[str] = []

    for scheme_id, scheme in GOVERNMENT_SCHEMES.items():
        elig = scheme["eligibility"]
        reasons_no: list[str] = []

        # --- Age check ---
        if elig.get("age_min") and age < elig["age_min"]:
            reasons_no.append(f"minimum age is {elig['age_min']} years")
        if elig.get("age_max") and age > elig["age_max"]:
            reasons_no.append(f"maximum age is {elig['age_max']} years")

        # --- Scheme-specific checks ---
        if scheme_id == "pm_kisan":
            if occupation != "farmer" and not has_land:
                reasons_no.append("requires farmer/landowner status")

        elif scheme_id == "sukanya_samriddhi":
            if not has_girl_child:
                reasons_no.append("requires a girl child below 10 years of age")
            elif girl_child_age is not None and girl_child_age >= 10:
                reasons_no.append(f"girl child must be below 10 years (provided: {girl_child_age})")

        elif scheme_id in ("pm_jjby", "pm_sby", "atal_pension"):
            if not has_bank_account:
                reasons_no.append("requires a savings bank account")

        elif scheme_id == "pmjdy":
            if has_bank_account:
                reasons_no.append("meant for those who do NOT have a bank account yet")

        elif scheme_id == "pm_mudra":
            if occupation not in ("self_employed", "farmer"):
                reasons_no.append("for non-corporate small/micro entrepreneurs only")

        if reasons_no:
            not_eligible.append(
                f"  NOT ELIGIBLE - {scheme['name']}\n"
                f"    Reason: {'; '.join(reasons_no)}"
            )
        else:
            eligible.append(
                f"  ELIGIBLE - {scheme['name']}\n"
                f"    Benefit: {scheme['benefit']}\n"
                f"    How to apply: {scheme['how_to_apply']}"
            )

    # --- Build result ---
    lines = [
        "GOVERNMENT SCHEME ELIGIBILITY REPORT",
        f"Profile: Age {age}, Income {_fmt_inr(monthly_income)}/month, "
        f"Gender: {gender}, Category: {category}, Occupation: {occupation}",
        "",
    ]

    if eligible:
        lines.append(f"SCHEMES YOU QUALIFY FOR ({len(eligible)}):")
        lines.extend(eligible)
        lines.append("")

    if not_eligible:
        lines.append(f"SCHEMES NOT APPLICABLE ({len(not_eligible)}):")
        lines.extend(not_eligible)
        lines.append("")

    lines.append(f"Data as of: {_now_stamp()}")
    lines.append("Source: Official government scheme guidelines. Eligibility is indicative "
                 "— final approval depends on verification by the implementing agency.")

    return _sanitise("\n".join(lines))


# =============================================================================
# TOOL 2: RBI REPO RATE & KEY RATES
# =============================================================================

async def get_rbi_rates() -> str:
    """Fetch current RBI key policy rates — repo rate, CRR, SLR, bank rate, and more.

    Returns the latest RBI Monetary Policy Committee (MPC) rates including
    repo rate, reverse repo rate, CRR, SLR, bank rate, MSF rate, and the
    Standing Deposit Facility rate. Tries a live API first, falls back to
    cached data if the API is unreachable.

    Returns:
        A formatted string with all RBI key rates and MPC stance.
    """
    # Check rate-limiting cache first
    cached = _cache_get("rbi_rates")
    if cached:
        return cached

    result_data = None
    source = "cache (IBJA/RBI website)"
    live_repo_rate = None
    live_repo_date = None

    # --- Attempt live fetch from data.gov.in (with 5-second timeout) ---
    api_key = os.environ.get("DATA_GOV_IN_API_KEY", "") or os.environ.get("RBI_API_KEY", "")
    if api_key:
        try:
            import aiohttp
            async with asyncio.timeout(5):
                async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=_SSL_CTX)) as session:
                    # data.gov.in — RBI repo rate history dataset
                    url = "https://api.data.gov.in/resource/fbc6c424-c841-4804-84ce-63effa215165"
                    params = {
                        "api-key": api_key,
                        "format": "json",
                        "limit": "10",
                        "offset": "0",
                    }
                    async with session.get(url, params=params) as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            records = data.get("records", []) if isinstance(data, dict) else []
                            if records:
                                # Get most recent record (latest repo rate)
                                latest = records[-1]
                                # Field names from data.gov.in schema
                                rate_key = "repo_rate__in_percent_"
                                date_key = "date"
                                if rate_key in latest:
                                    live_repo_rate = float(latest[rate_key])
                                    live_repo_date = latest.get(date_key, "unknown")
                                    source = f"data.gov.in (live, dataset: RBI repo rate history)"
                                    logger.info(
                                        "RBI live fetch: repo=%s%% date=%s",
                                        live_repo_rate, live_repo_date,
                                    )
        except Exception as e:
            logger.debug("RBI data.gov.in API unavailable (%s) — using cached rates", e)

    # --- Fall back to cached data (RBI current values) ---
    result_data = dict(RBI_RATES_CACHE)  # copy so we can override

    # If live fetch got a repo rate, patch it in
    if live_repo_rate is not None:
        if isinstance(result_data.get("repo_rate"), dict):
            result_data["repo_rate"]["value"] = live_repo_rate
        else:
            result_data["repo_rate"] = live_repo_rate
        if live_repo_date:
            result_data["last_mpc_date"] = live_repo_date

    # --- Build response ---
    lines = [
        "RBI KEY POLICY RATES",
        "=" * 45,
    ]

    rate_order = [
        "repo_rate", "standing_deposit_facility", "marginal_standing_facility",
        "bank_rate", "reverse_repo_rate", "crr", "slr",
    ]

    for key in rate_order:
        if key in result_data:
            entry = result_data[key]
            if isinstance(entry, dict):
                val = entry.get("value", "N/A")
                desc = entry.get("description", "")
                label = key.replace("_", " ").title()
                lines.append(f"  {label}: {val}%")
                if desc:
                    lines.append(f"    ({desc.split('.')[0].strip()})")
            else:
                label = key.replace("_", " ").title()
                lines.append(f"  {label}: {entry}%")

    lines.append("")
    lines.append(f"MPC Stance: {result_data.get('stance', 'N/A')}")
    lines.append(f"Last MPC meeting: {result_data.get('last_mpc_date', 'N/A')}")
    lines.append(f"Next MPC meeting: {result_data.get('next_mpc_date', 'N/A')}")
    lines.append("")
    lines.append(f"Data as of: {_now_stamp()} (Source: {result_data.get('source', source)})")

    result = "\n".join(lines)
    _cache_set("rbi_rates", result)
    return result


# =============================================================================
# TOOL 3: GOLD & SILVER PRICE LOOKUP
# =============================================================================

async def get_gold_silver_prices() -> str:
    """Fetch live gold and silver prices in India (INR per gram and per 10 grams).

    Returns current/recent prices for 24K gold, 22K gold, 18K gold,
    and silver in INR. Tries a live API (GoldAPI.io or similar), falls
    back to cached IBJA indicative rates if the API is unreachable.

    Returns:
        A formatted string with gold and silver prices in various units.
    """
    cached = _cache_get("metal_prices")
    if cached:
        return cached

    prices = None
    source = "IBJA indicative rates (cached)"

    # --- Attempt live fetch ---
    api_key = os.environ.get("GOLD_API_KEY", "")
    if api_key:
        try:
            import aiohttp
            async with asyncio.timeout(5):
                async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=_SSL_CTX)) as session:
                    # GoldAPI.io endpoint for INR gold price
                    url = "https://www.goldapi.io/api/XAU/INR"
                    headers = {
                        "x-access-token": api_key,
                        "Content-Type": "application/json",
                    }
                    async with session.get(url, headers=headers) as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            if data and "price_gram_24k" in data:
                                prices = {
                                    "gold_24k_per_gram": round(data["price_gram_24k"], 2),
                                    "gold_22k_per_gram": round(data.get("price_gram_22k",
                                                                data["price_gram_24k"] * 0.9167), 2),
                                    "gold_18k_per_gram": round(data.get("price_gram_18k",
                                                                data["price_gram_24k"] * 0.75), 2),
                                    "gold_24k_per_10g": round(data["price_gram_24k"] * 10, 2),
                                    "gold_22k_per_10g": round(
                                        data.get("price_gram_22k",
                                                  data["price_gram_24k"] * 0.9167) * 10, 2),
                                }
                                source = "GoldAPI.io (live)"
                                logger.info("Gold prices fetched from live API")
        except Exception:
            logger.debug("Gold API unavailable — using cached prices")

    # --- Try silver API if gold succeeded ---
    if prices and api_key:
        try:
            import aiohttp
            async with asyncio.timeout(5):
                async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=_SSL_CTX)) as session:
                    url = "https://www.goldapi.io/api/XAG/INR"
                    headers = {
                        "x-access-token": api_key,
                        "Content-Type": "application/json",
                    }
                    async with session.get(url, headers=headers) as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            if data and "price_gram_24k" in data:
                                prices["silver_per_gram"] = round(data["price_gram_24k"], 2)
                                prices["silver_per_kg"] = round(data["price_gram_24k"] * 1000, 2)
        except Exception:
            # Use cached silver if live fails
            prices["silver_per_gram"] = METAL_PRICES_CACHE["silver_per_gram"]
            prices["silver_per_kg"] = METAL_PRICES_CACHE["silver_per_kg"]

    # --- Fall back to cache ---
    if prices is None:
        prices = METAL_PRICES_CACHE.copy()

    # --- Build response ---
    lines = [
        "GOLD & SILVER PRICES IN INDIA",
        "=" * 45,
        "",
        "GOLD:",
        f"  24 Karat (pure):  Rs {prices['gold_24k_per_gram']:,.2f} per gram  |  "
        f"Rs {prices.get('gold_24k_per_10g', prices['gold_24k_per_gram'] * 10):,.2f} per 10 grams",
        f"  22 Karat (jewellery):  Rs {prices['gold_22k_per_gram']:,.2f} per gram  |  "
        f"Rs {prices.get('gold_22k_per_10g', prices['gold_22k_per_gram'] * 10):,.2f} per 10 grams",
        f"  18 Karat:  Rs {prices.get('gold_18k_per_gram', prices['gold_24k_per_gram'] * 0.75):,.2f} per gram",
        "",
        "SILVER:",
        f"  Silver:  Rs {prices.get('silver_per_gram', 95.50):,.2f} per gram  |  "
        f"Rs {prices.get('silver_per_kg', 95500.00):,.2f} per kg",
        "",
        "QUICK REFERENCE:",
        f"  1 tola gold (11.66g) 24K = Rs {prices['gold_24k_per_gram'] * 11.66:,.0f}",
        f"  1 sovereign (8g) 22K = Rs {prices['gold_22k_per_gram'] * 8:,.0f}",
        "",
        "Note: Actual jewellery prices include making charges (8-25%) and GST (3%).",
        f"Data as of: {_now_stamp()} (Source: {source})",
    ]

    result = "\n".join(lines)
    _cache_set("metal_prices", result)
    return result


# =============================================================================
# TOOL 4: FIXED DEPOSIT RATE COMPARISON
# =============================================================================

async def compare_fd_rates(
    tenure_months: int = 12,
    amount: float = 100000,
    is_senior_citizen: bool = False,
) -> str:
    """Compare Fixed Deposit interest rates across top Indian banks for a given tenure.

    Shows FD rates from SBI, HDFC, ICICI, Axis, Kotak, PNB, and Bank of Baroda
    for the specified tenure. Also shows maturity amount estimates and ranks
    banks from highest to lowest rate.

    Args:
        tenure_months: FD tenure in months (1 to 120). Default 12.
        amount: Deposit amount in rupees. Default Rs 1,00,000.
        is_senior_citizen: Whether the depositor is a senior citizen (60+).
                          Senior citizens get 0.25-0.50% extra.

    Returns:
        A formatted comparison table with rates, maturity amounts, and ranking.
    """
    # --- Input validation ---
    tenure_months = max(1, min(int(tenure_months), 120))
    amount = max(1000, float(amount))

    # --- Look up rates for each bank ---
    comparisons: list[tuple[str, str, float, float]] = []  # (bank, full_name, rate, maturity)

    for bank_code, bank_data in FD_RATES.items():
        rate = None
        for (min_m, max_m), r in bank_data["rates"].items():
            if min_m <= tenure_months <= max_m:
                rate = r
                break

        if rate is None:
            # Tenure beyond defined ranges — use the last bracket
            last_bracket = max(bank_data["rates"].keys(), key=lambda k: k[1])
            rate = bank_data["rates"][last_bracket]

        if is_senior_citizen:
            rate += bank_data.get("senior_extra", 0.50)

        # Maturity amount (quarterly compounding, standard for Indian FDs)
        n = 4  # quarterly compounding
        years = tenure_months / 12
        maturity = amount * (1 + rate / (100 * n)) ** (n * years)

        comparisons.append((bank_code, bank_data["full_name"], rate, maturity))

    # Sort by rate descending
    comparisons.sort(key=lambda x: x[2], reverse=True)

    # --- Build response ---
    citizen_type = "Senior Citizen" if is_senior_citizen else "General"
    tenure_str = (
        f"{tenure_months} months"
        if tenure_months < 12
        else f"{tenure_months} months ({tenure_months // 12} year{'s' if tenure_months >= 24 else ''}"
        f"{f' {tenure_months % 12} months' if tenure_months % 12 else ''})"
    )

    lines = [
        "FIXED DEPOSIT RATE COMPARISON",
        "=" * 55,
        f"Tenure: {tenure_str}  |  Deposit: {_fmt_inr(amount)}  |  Category: {citizen_type}",
        "",
        f"{'Rank':<5} {'Bank':<8} {'Rate':<8} {'Maturity Amount':<18} {'Interest Earned'}",
        "-" * 60,
    ]

    for rank, (bank, full_name, rate, maturity) in enumerate(comparisons, 1):
        interest = maturity - amount
        lines.append(
            f"  {rank:<4} {bank:<8} {rate:.2f}%   {_fmt_inr(maturity):<18} {_fmt_inr(interest)}"
        )

    # Best and special offers
    best = comparisons[0]
    lines.append("")
    lines.append(f"BEST RATE: {best[0]} ({best[1]}) at {best[2]:.2f}% — "
                 f"you earn {_fmt_inr(best[3] - amount)} interest on {_fmt_inr(amount)}")

    # Add any special offers
    specials = [
        f"  {code}: {FD_RATES[code]['special']}"
        for code, _, _, _ in comparisons
        if FD_RATES[code].get("special")
    ]
    if specials:
        lines.append("")
        lines.append("SPECIAL OFFERS:")
        lines.extend(specials)

    lines.append("")
    lines.append("Note: Rates are subject to change. TDS of 10% applies on interest "
                 "exceeding Rs 40,000/year (Rs 50,000 for seniors). Submit Form 15G/15H "
                 "if income below taxable limit.")
    lines.append(f"Data as of: {_now_stamp()} (Rates last verified: {FD_RATES_LAST_UPDATED})")

    return "\n".join(lines)


# =============================================================================
# TOOL 5: LOAN EMI + ELIGIBILITY ESTIMATOR
# =============================================================================

async def estimate_loan_eligibility(
    monthly_income: float,
    existing_emi: float = 0,
    loan_type: str = "home",
    desired_amount: float | None = None,
    tenure_months: int | None = None,
    interest_rate: float | None = None,
) -> str:
    """Estimate maximum eligible loan amount and calculate EMI based on income.

    Uses standard banking FOIR (Fixed Obligation to Income Ratio) rules to
    estimate how much loan a person can get, then calculates the monthly EMI.
    Supports home loan, personal loan, car loan, education loan, gold loan,
    and business loan.

    Args:
        monthly_income: Gross monthly income in rupees.
        existing_emi: Total existing EMI obligations per month (default 0).
        loan_type: One of 'home', 'personal', 'car', 'education', 'gold', 'business'.
        desired_amount: Specific loan amount the user wants (optional — if not
                       given, shows maximum eligible amount).
        tenure_months: Loan tenure in months (optional — uses default for loan type).
        interest_rate: Annual interest rate percent (optional — uses default).

    Returns:
        A formatted string with eligibility assessment, EMI calculation, and
        a full amortisation summary.
    """
    # --- Input validation ---
    monthly_income = max(0, float(monthly_income))
    existing_emi = max(0, float(existing_emi))
    loan_key = loan_type.lower().strip().replace(" ", "_").replace("-", "_")

    # Normalise common spoken forms
    alias_map = {
        "home_loan": "home", "housing": "home", "mortgage": "home",
        "personal_loan": "personal", "pl": "personal",
        "car_loan": "car", "vehicle": "car", "auto": "car",
        "education_loan": "education", "student": "education", "edu": "education",
        "gold_loan": "gold",
        "business_loan": "business", "msme": "business",
    }
    loan_key = alias_map.get(loan_key, loan_key)

    if loan_key not in LOAN_PARAMS:
        return (f"Unknown loan type: '{loan_type}'. "
                f"Supported types: home, personal, car, education, gold, business. "
                f"Data as of: {_now_stamp()}")

    params = LOAN_PARAMS[loan_key]
    rate = interest_rate if interest_rate else params["default_rate"]
    tenure = tenure_months if tenure_months else params["default_tenure_months"]
    tenure = max(1, min(int(tenure), params["max_tenure_months"]))

    # --- FOIR-based eligibility ---
    max_foir = params["max_foir"]
    max_emi_affordable = (monthly_income * max_foir) - existing_emi

    if max_emi_affordable <= 0:
        lines = [
            f"LOAN ELIGIBILITY ASSESSMENT — {params['display_name']}",
            "=" * 50,
            "",
            "RESULT: NOT ELIGIBLE at current income and obligations.",
            "",
            f"  Monthly income: {_fmt_inr(monthly_income)}",
            f"  Existing EMIs: {_fmt_inr(existing_emi)}",
            f"  Max allowed EMI (FOIR {max_foir * 100:.0f}%): {_fmt_inr(monthly_income * max_foir)}",
            "",
            "Your existing EMI obligations already exceed or match the maximum "
            "allowed under FOIR guidelines. Consider:",
            "  - Closing an existing loan to improve eligibility",
            "  - Increasing income (add co-applicant for home loans)",
            "  - Choosing a longer tenure to reduce EMI burden",
            f"",
            f"Data as of: {_now_stamp()}",
        ]
        return "\n".join(lines)

    if monthly_income < params.get("min_income_monthly", 0):
        min_req = params["min_income_monthly"]
        lines = [
            f"LOAN ELIGIBILITY ASSESSMENT — {params['display_name']}",
            "=" * 50,
            "",
            f"RESULT: Below minimum income requirement.",
            f"  Your income: {_fmt_inr(monthly_income)}/month",
            f"  Minimum required: {_fmt_inr(min_req)}/month",
            "",
            "Tip: Adding a co-applicant (spouse/parent) can combine incomes "
            "to meet the threshold.",
            f"",
            f"Data as of: {_now_stamp()}",
        ]
        return "\n".join(lines)

    # --- Calculate max eligible loan from max affordable EMI ---
    monthly_rate = rate / (12 * 100)
    if monthly_rate > 0:
        # P = EMI * [(1+r)^n - 1] / [r * (1+r)^n]
        factor = (1 + monthly_rate) ** tenure
        max_loan = max_emi_affordable * (factor - 1) / (monthly_rate * factor)
    else:
        max_loan = max_emi_affordable * tenure

    # --- Calculate EMI for desired or max amount ---
    loan_amount = desired_amount if desired_amount else max_loan

    if desired_amount and desired_amount > max_loan * 1.1:
        # User wants more than they qualify for
        over_limit = True
    else:
        over_limit = False
        loan_amount = min(loan_amount, max_loan)

    if monthly_rate > 0:
        factor = (1 + monthly_rate) ** tenure
        emi = loan_amount * monthly_rate * factor / (factor - 1)
    else:
        emi = loan_amount / tenure

    total_payable = emi * tenure
    total_interest = total_payable - loan_amount

    # --- Build response ---
    lines = [
        f"LOAN ELIGIBILITY & EMI ESTIMATE — {params['display_name']}",
        "=" * 55,
        "",
        "YOUR PROFILE:",
        f"  Monthly income: {_fmt_inr(monthly_income)}",
        f"  Existing EMIs: {_fmt_inr(existing_emi)}",
        f"  Available for new EMI (FOIR {max_foir * 100:.0f}%): {_fmt_inr(max_emi_affordable)}",
        "",
        "ELIGIBILITY:",
        f"  Maximum eligible loan: {_fmt_inr(max_loan)}",
        f"  At {rate}% for {tenure} months ({tenure // 12} year{'s' if tenure >= 24 else ''}"
        f"{f' {tenure % 12} months' if tenure % 12 else ''})",
        f"  Typical rate range: {params['rate_range']}",
        "",
    ]

    if over_limit:
        lines.append(f"WARNING: Desired amount ({_fmt_inr(desired_amount)}) exceeds "
                     f"maximum eligible ({_fmt_inr(max_loan)}). Showing EMI for desired amount:")
        lines.append("")

    lines.extend([
        "EMI CALCULATION:",
        f"  Loan amount: {_fmt_inr(loan_amount)}",
        f"  Interest rate: {rate}% per annum",
        f"  Tenure: {tenure} months",
        f"  Monthly EMI: {_fmt_inr(emi)}",
        f"  Total interest: {_fmt_inr(total_interest)}",
        f"  Total payable: {_fmt_inr(total_payable)}",
        "",
        "COST BREAKDOWN:",
        f"  Principal: {loan_amount / total_payable * 100:.1f}% of total payment",
        f"  Interest: {total_interest / total_payable * 100:.1f}% of total payment",
        "",
        f"Processing fee: {params['processing_fee']}",
    ])

    if params.get("tax_benefit"):
        lines.append(f"Tax benefit: {params['tax_benefit']}")

    if params.get("moratorium"):
        lines.append(f"Moratorium: {params['moratorium']}")

    lines.append("")
    lines.append("Note: This is an indicative estimate. Actual eligibility depends on "
                 "credit score (CIBIL 750+), employment stability, and bank-specific norms.")
    lines.append(f"Data as of: {_now_stamp()}")

    return "\n".join(lines)


# =============================================================================
# TOOL 6: DOCUMENT CHECKLIST GENERATOR
# =============================================================================

async def get_document_checklist(
    product: str,
) -> str:
    """Get the exact list of documents needed for a financial product.

    Covers savings account, fixed deposit, home loan, personal loan,
    car loan, education loan, credit card, mutual fund, and demat account.
    Returns mandatory and additional documents with practical tips.

    Args:
        product: Financial product name — e.g. 'savings account', 'FD',
                'home loan', 'personal loan', 'car loan', 'education loan',
                'credit card', 'mutual fund', 'demat account'.

    Returns:
        A formatted checklist string with mandatory docs, optional docs,
        and important notes.
    """
    # --- Normalise product name ---
    key = product.lower().strip()
    key = re.sub(r"[^a-z0-9_\s]", "", key)
    key = key.replace(" ", "_")

    alias_map = {
        "savings": "savings_account",
        "savings_account": "savings_account",
        "bank_account": "savings_account",
        "saving_account": "savings_account",
        "fd": "fixed_deposit",
        "fixed_deposit": "fixed_deposit",
        "fdr": "fixed_deposit",
        "term_deposit": "fixed_deposit",
        "home_loan": "home_loan",
        "housing_loan": "home_loan",
        "mortgage": "home_loan",
        "personal_loan": "personal_loan",
        "pl": "personal_loan",
        "car_loan": "car_loan",
        "vehicle_loan": "car_loan",
        "auto_loan": "car_loan",
        "two_wheeler_loan": "car_loan",
        "education_loan": "education_loan",
        "student_loan": "education_loan",
        "study_loan": "education_loan",
        "credit_card": "credit_card",
        "cc": "credit_card",
        "mutual_fund": "mutual_fund",
        "mf": "mutual_fund",
        "sip": "mutual_fund",
        "demat": "demat_account",
        "demat_account": "demat_account",
        "trading_account": "demat_account",
        "share_account": "demat_account",
    }

    resolved = alias_map.get(key)
    if not resolved:
        # Fuzzy match — check if any alias is a substring
        for alias, target in alias_map.items():
            if alias in key or key in alias:
                resolved = target
                break

    if not resolved or resolved not in DOCUMENT_CHECKLISTS:
        available = ", ".join(sorted(set(alias_map.values())))
        return (f"Product '{product}' not recognised. Available products: {available}. "
                f"Please try again with one of these. Data as of: {_now_stamp()}")

    checklist = DOCUMENT_CHECKLISTS[resolved]

    lines = [
        f"DOCUMENT CHECKLIST — {checklist['product_name']}",
        "=" * 50,
        "",
        "MANDATORY DOCUMENTS:",
    ]

    for i, doc in enumerate(checklist["mandatory"], 1):
        lines.append(f"  {i}. {doc}")

    if checklist.get("additional"):
        lines.append("")
        lines.append("ADDITIONAL / RECOMMENDED:")
        for i, doc in enumerate(checklist["additional"], 1):
            lines.append(f"  {i}. {doc}")

    if checklist.get("notes"):
        lines.append("")
        lines.append("IMPORTANT NOTES:")
        lines.append(f"  {checklist['notes']}")

    lines.append("")
    lines.append("Tip: Keep colour photocopies of all documents. Most banks now accept "
                 "DigiLocker-linked documents for paperless processing.")
    lines.append(f"Data as of: {_now_stamp()}")

    return "\n".join(lines)


# =============================================================================
# TOOL REGISTRY — for import into agent.py
# =============================================================================
# Returns metadata dicts that agent.py can use to register these as
# @function_tool methods on the VoicePayAgent class.

DAY5_TOOLS = {
    "check_scheme_eligibility": {
        "fn": check_scheme_eligibility,
        "description": (
            "Check eligibility for major Indian government financial schemes "
            "(PM-KISAN, Sukanya Samriddhi, PMJJBY, PMSBY, PMJDY, Atal Pension, "
            "Mudra) based on user's age, income, gender, category, and occupation. "
            "Call this when the user asks about 'sarkari yojana', 'government scheme', "
            "'eligibility', 'am I eligible', 'kya mujhe milega', 'benefits', or "
            "mentions any specific scheme name."
        ),
    },
    "get_rbi_rates": {
        "fn": get_rbi_rates,
        "description": (
            "Fetch current RBI policy rates — repo rate, reverse repo, CRR, SLR, "
            "bank rate, MSF rate, and monetary policy stance. Call this when the user "
            "asks about 'repo rate', 'RBI rate', 'interest rate', 'CRR', 'SLR', "
            "'monetary policy', 'bank rate', or 'policy rate'."
        ),
    },
    "get_gold_silver_prices": {
        "fn": get_gold_silver_prices,
        "description": (
            "Fetch current gold and silver prices in India in INR per gram — "
            "24K, 22K, 18K gold and silver per gram/kg. Call this when the user "
            "asks about 'sone ka bhav', 'gold rate', 'gold price', 'silver price', "
            "'chandi ka bhav', 'today gold rate', or 'metal prices'."
        ),
    },
    "compare_fd_rates": {
        "fn": compare_fd_rates,
        "description": (
            "Compare Fixed Deposit interest rates across top Indian banks (SBI, "
            "HDFC, ICICI, Axis, Kotak, PNB, Bank of Baroda) for a given tenure. "
            "Shows which bank gives the best rate and calculates maturity amount. "
            "Call this when the user asks about 'FD rate', 'fixed deposit', 'best FD', "
            "'deposit rate comparison', 'which bank gives best interest', or "
            "'FD mein kitna milega'."
        ),
    },
    "estimate_loan_eligibility": {
        "fn": estimate_loan_eligibility,
        "description": (
            "Estimate maximum eligible loan amount and calculate monthly EMI based "
            "on income, existing obligations, and loan type. Uses FOIR rules. "
            "Supports home/personal/car/education/gold/business loans. Call this when "
            "the user asks about 'loan eligibility', 'how much loan can I get', "
            "'kitna loan milega', 'EMI on salary', 'loan affordability', or "
            "'am I eligible for loan'. Different from the simple emi_calculator — "
            "this also checks income-based eligibility."
        ),
    },
    "get_document_checklist": {
        "fn": get_document_checklist,
        "description": (
            "Get the exact list of documents needed for a financial product — "
            "savings account, FD, home loan, personal loan, car loan, education loan, "
            "credit card, mutual fund, or demat account. Call this when the user asks "
            "'kya documents chahiye', 'what documents do I need', 'document list', "
            "'kya kya lana hoga', or 'paperwork for [product]'."
        ),
    },
}


def get_day5_tools() -> dict[str, dict]:
    """Return all Day 5 tool definitions for registration in agent.py.

    Usage in agent.py:
        from tools_day5 import get_day5_tools, DAY5_TOOLS

        # Option A: Use the functions directly as @function_tool
        # Option B: Register dynamically (see below)

    Each entry has:
        - fn: the async callable (returns str)
        - description: Gemini-optimised description for tool selection
    """
    return DAY5_TOOLS
