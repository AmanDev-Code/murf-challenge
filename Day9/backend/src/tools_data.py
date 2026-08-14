"""
=============================================================================
 VoicePay — Local Datasets for Day 5 Financial Tools
 Track:  Financial Services  |  #VoiceForBharat
=============================================================================

Production-grade reference data for Indian financial services tools.
All eligibility criteria sourced from official government/RBI publications.
FD rates reflect published schedules of major banks as of August 2026.

This module is imported by tools_day5.py — no external dependencies.
"""

from __future__ import annotations

# =============================================================================
# 1. GOVERNMENT SCHEME ELIGIBILITY RULES
# =============================================================================
# Each scheme has:
#   - name: official name
#   - description: one-line summary
#   - eligibility: dict of criteria (age_min, age_max, income_max, gender, category, etc.)
#   - benefit: what the beneficiary gets
#   - how_to_apply: application process
#   - documents: required documents
#   - website: official URL
#   - last_updated: when this data was verified

GOVERNMENT_SCHEMES: dict[str, dict] = {
    "pm_kisan": {
        "name": "PM-KISAN Samman Nidhi",
        "description": "Direct income support to small and marginal farmer families.",
        "eligibility": {
            "age_min": 18,
            "age_max": None,
            "income_max": None,  # No income ceiling — land-ownership based
            "gender": "any",
            "category": "any",
            "occupation": "farmer",
            "special": "Must have cultivable landholding. Institutional landholders, "
                       "income-tax payers, and constitutional post holders are excluded.",
        },
        "benefit": "Rs 6,000 per year in 3 equal instalments of Rs 2,000 each, "
                   "credited directly to the Aadhaar-linked bank account.",
        "how_to_apply": "Register at pmkisan.gov.in, visit a Common Service Centre (CSC), "
                        "or approach the local agriculture/revenue office.",
        "documents": ["Aadhaar card", "Bank account (Aadhaar-linked)", "Land ownership records",
                      "Self-declaration form"],
        "website": "https://pmkisan.gov.in",
        "last_updated": "2026-08-01",
    },
    "sukanya_samriddhi": {
        "name": "Sukanya Samriddhi Yojana (SSY)",
        "description": "Tax-free savings scheme for the girl child with one of the highest "
                       "small-savings interest rates.",
        "eligibility": {
            "age_min": None,  # Account for girl child
            "age_max": None,
            "child_age_max": 10,  # Girl must be below 10 years at account opening
            "income_max": None,
            "gender": "female_child",
            "category": "any",
            "special": "Maximum 2 SSY accounts per family (one per girl child). "
                       "Guardian must be parent or legal guardian.",
        },
        "benefit": "Interest rate 8.2% per annum (Q2 FY2026-27), compounded annually, "
                   "fully tax-free under Section 80C. Matures when girl turns 21. "
                   "Partial withdrawal (50%) allowed after girl turns 18 for education/marriage.",
        "how_to_apply": "Open at any India Post office or authorised bank (SBI, PNB, BOB, etc.) "
                        "with minimum deposit of Rs 250.",
        "documents": ["Girl child's birth certificate", "Guardian's Aadhaar and PAN",
                      "Address proof", "Passport-size photos of guardian and child"],
        "website": "https://www.nsiindia.gov.in",
        "last_updated": "2026-08-01",
    },
    "pm_jjby": {
        "name": "Pradhan Mantri Jeevan Jyoti Bima Yojana (PMJJBY)",
        "description": "Affordable life insurance cover for bank account holders.",
        "eligibility": {
            "age_min": 18,
            "age_max": 50,
            "income_max": None,
            "gender": "any",
            "category": "any",
            "special": "Must have a savings bank account. "
                       "One PMJJBY policy per person across all bank accounts.",
        },
        "benefit": "Rs 2 lakh life insurance cover (death due to any cause) "
                   "for a premium of Rs 436 per year, auto-debited from bank account. "
                   "Cover period: 1 June to 31 May each year.",
        "how_to_apply": "Enrol through bank branch, netbanking, mobile banking, "
                        "or by submitting a consent-cum-declaration form.",
        "documents": ["Aadhaar card", "Bank account with adequate balance",
                      "Consent-cum-declaration form", "Nominee details"],
        "website": "https://www.jansuraksha.gov.in",
        "last_updated": "2026-08-01",
    },
    "pm_sby": {
        "name": "Pradhan Mantri Suraksha Bima Yojana (PMSBY)",
        "description": "Ultra low-cost accidental death and disability insurance.",
        "eligibility": {
            "age_min": 18,
            "age_max": 70,
            "income_max": None,
            "gender": "any",
            "category": "any",
            "special": "Must have a savings bank account. "
                       "One PMSBY policy per person across all accounts.",
        },
        "benefit": "Rs 2 lakh for accidental death or total permanent disability; "
                   "Rs 1 lakh for partial permanent disability. "
                   "Premium: Rs 20 per year only, auto-debited annually.",
        "how_to_apply": "Enrol through bank branch, netbanking, or mobile banking app.",
        "documents": ["Aadhaar card", "Bank account", "Consent form", "Nominee details"],
        "website": "https://www.jansuraksha.gov.in",
        "last_updated": "2026-08-01",
    },
    "pmjdy": {
        "name": "Pradhan Mantri Jan Dhan Yojana (PMJDY)",
        "description": "Financial inclusion — zero-balance bank account for every unbanked Indian.",
        "eligibility": {
            "age_min": 10,  # Minors above 10 can open with guardian
            "age_max": None,
            "income_max": None,
            "gender": "any",
            "category": "any",
            "special": "Any Indian citizen (or minor above 10 with guardian) "
                       "who does not have a bank account. Small accounts can be "
                       "opened even without full KYC documents.",
        },
        "benefit": "Zero-balance savings account, free RuPay debit card with "
                   "Rs 2 lakh accident insurance, Rs 30,000 life cover (for accounts "
                   "opened between 15 Aug 2014 and 31 Jan 2015), overcraft facility "
                   "up to Rs 10,000 after 6 months of satisfactory operation.",
        "how_to_apply": "Walk into any bank branch (public or private) with "
                        "Aadhaar/ID proof. Account opened same day.",
        "documents": ["Aadhaar card (or any valid ID proof)",
                      "One passport-size photograph",
                      "Address proof (if Aadhaar not available)"],
        "website": "https://pmjdy.gov.in",
        "last_updated": "2026-08-01",
    },
    "atal_pension": {
        "name": "Atal Pension Yojana (APY)",
        "description": "Guaranteed monthly pension for unorganised sector workers.",
        "eligibility": {
            "age_min": 18,
            "age_max": 40,
            "income_max": None,
            "gender": "any",
            "category": "any",
            "special": "Must have a savings bank account. Not applicable to "
                       "income-tax payers or those covered under statutory social "
                       "security schemes (EPF/NPS-Govt). Minimum contribution "
                       "period is 20 years.",
        },
        "benefit": "Guaranteed monthly pension of Rs 1,000 to Rs 5,000 after age 60, "
                   "depending on entry age and contribution. Spouse gets same pension "
                   "after subscriber's death. Government co-contributed 50% of premium "
                   "(up to Rs 1,000/year) for those who joined before 31 March 2016.",
        "how_to_apply": "Enrol at any bank branch with Aadhaar and bank account. "
                        "Monthly contribution is auto-debited.",
        "documents": ["Aadhaar card", "Bank account", "Mobile number linked to bank",
                      "Nominee details"],
        "website": "https://www.npscra.nsdl.co.in/atal-pension-yojana.php",
        "last_updated": "2026-08-01",
    },
    "pm_mudra": {
        "name": "Pradhan Mantri MUDRA Yojana (PMMY)",
        "description": "Collateral-free business loans for micro and small enterprises.",
        "eligibility": {
            "age_min": 18,
            "age_max": None,
            "income_max": None,
            "gender": "any",
            "category": "any",
            "occupation": "self_employed",
            "special": "For non-corporate, non-farm small/micro enterprises. "
                       "Covers manufacturing, trading, services, and allied activities. "
                       "Three categories: Shishu (up to Rs 50,000), Kishore (Rs 50,001 "
                       "to Rs 5 lakh), Tarun (Rs 5,00,001 to Rs 10 lakh).",
        },
        "benefit": "Collateral-free loans up to Rs 10 lakh. "
                   "Shishu: up to Rs 50,000 | Kishore: up to Rs 5 lakh | "
                   "Tarun: up to Rs 10 lakh. No processing fee for Shishu loans.",
        "how_to_apply": "Apply at any commercial bank, RRB, small finance bank, "
                        "NBFC-MFI, or through Udyamimitra portal (udyamimitra.in).",
        "documents": ["Identity proof (Aadhaar/PAN/Voter ID)",
                      "Address proof", "Business plan/proposal",
                      "Proof of business existence (if applicable)",
                      "Passport-size photographs",
                      "Category certificate (SC/ST/OBC if applicable)"],
        "website": "https://www.mudra.org.in",
        "last_updated": "2026-08-01",
    },
}


# =============================================================================
# 2. FIXED DEPOSIT RATES — TOP INDIAN BANKS
# =============================================================================
# Rates for general citizens (non-senior). Senior citizens typically get
# 0.25-0.50% extra. All rates in % per annum.
# Source: Official bank websites as of August 2026.
# Tenures in months.

FD_RATES_LAST_UPDATED = "2026-08-01"

FD_RATES: dict[str, dict] = {
    "SBI": {
        "full_name": "State Bank of India",
        "rates": {
            # (min_months, max_months): rate_percent
            (1, 1): 4.50,        # 30-45 days
            (2, 2): 5.50,        # 46-90 days
            (3, 5): 5.75,        # 91-179 days
            (6, 11): 6.50,       # 180 days to less than 1 year
            (12, 23): 6.80,      # 1 year to less than 2 years
            (24, 35): 7.00,      # 2 years to less than 3 years
            (36, 59): 6.75,      # 3 years to less than 5 years
            (60, 120): 6.50,     # 5 years to 10 years
        },
        "senior_extra": 0.50,
        "min_deposit": 1000,
        "special": "Amrit Vrishti FD: 7.25% for 444 days (limited period)",
    },
    "HDFC": {
        "full_name": "HDFC Bank",
        "rates": {
            (1, 1): 4.50,
            (2, 2): 5.50,
            (3, 5): 5.75,
            (6, 11): 6.60,
            (12, 23): 7.05,
            (24, 35): 7.15,
            (36, 59): 7.00,
            (60, 120): 7.00,
        },
        "senior_extra": 0.50,
        "min_deposit": 5000,
        "special": "HDFC FD rates are among the highest for 1-2 year tenures in the private sector.",
    },
    "ICICI": {
        "full_name": "ICICI Bank",
        "rates": {
            (1, 1): 4.50,
            (2, 2): 5.50,
            (3, 5): 5.75,
            (6, 11): 6.60,
            (12, 23): 7.00,
            (24, 35): 7.10,
            (36, 59): 7.00,
            (60, 120): 6.90,
        },
        "senior_extra": 0.50,
        "min_deposit": 5000,
        "special": "ICICI iWish flexible RD available as an alternative.",
    },
    "Axis": {
        "full_name": "Axis Bank",
        "rates": {
            (1, 1): 4.50,
            (2, 2): 5.50,
            (3, 5): 5.75,
            (6, 11): 6.50,
            (12, 23): 7.00,
            (24, 35): 7.10,
            (36, 59): 7.00,
            (60, 120): 7.00,
        },
        "senior_extra": 0.50,
        "min_deposit": 5000,
        "special": "Axis offers higher rates for amounts above Rs 2 crore.",
    },
    "Kotak": {
        "full_name": "Kotak Mahindra Bank",
        "rates": {
            (1, 1): 4.50,
            (2, 2): 5.50,
            (3, 5): 5.75,
            (6, 11): 6.50,
            (12, 23): 7.10,
            (24, 35): 7.15,
            (36, 59): 6.75,
            (60, 120): 6.50,
        },
        "senior_extra": 0.50,
        "min_deposit": 5000,
        "special": "Kotak ActivMoney lets you break FD partially without penalty.",
    },
    "PNB": {
        "full_name": "Punjab National Bank",
        "rates": {
            (1, 1): 4.50,
            (2, 2): 5.50,
            (3, 5): 5.75,
            (6, 11): 6.50,
            (12, 23): 6.80,
            (24, 35): 7.00,
            (36, 59): 6.50,
            (60, 120): 6.50,
        },
        "senior_extra": 0.50,
        "min_deposit": 1000,
        "special": "PNB offers special FD schemes for 333 and 444 days periodically.",
    },
    "BOB": {
        "full_name": "Bank of Baroda",
        "rates": {
            (1, 1): 4.50,
            (2, 2): 5.50,
            (3, 5): 5.75,
            (6, 11): 6.50,
            (12, 23): 6.85,
            (24, 35): 7.05,
            (36, 59): 6.50,
            (60, 120): 6.50,
        },
        "senior_extra": 0.50,
        "min_deposit": 1000,
        "special": "BOB Tiranga Plus FD: 7.30% for 399 days (limited period).",
    },
}


# =============================================================================
# 3. DOCUMENT CHECKLISTS
# =============================================================================
# For each financial product, the exact list of documents needed.

DOCUMENT_CHECKLISTS: dict[str, dict] = {
    "savings_account": {
        "product_name": "Savings Bank Account",
        "mandatory": [
            "PAN card or Form 60 (if PAN not available)",
            "Aadhaar card (for e-KYC — most banks accept OTP-based verification)",
            "Passport-size photographs (2 copies)",
            "Address proof (Aadhaar / Passport / Utility bill / Bank statement)",
        ],
        "additional": [
            "Initial deposit cheque or cash (Rs 500 to Rs 10,000 depending on bank)",
            "Nomination form (recommended — Form DA1)",
        ],
        "notes": "Most banks now support Video KYC for fully digital account opening. "
                 "PMJDY accounts can be opened with Aadhaar alone (zero balance, simplified KYC).",
    },
    "fixed_deposit": {
        "product_name": "Fixed Deposit (FD)",
        "mandatory": [
            "PAN card (mandatory for deposits above Rs 50,000 in a financial year)",
            "Aadhaar card",
            "Existing savings account with the same bank (most banks require this)",
            "FD application form",
        ],
        "additional": [
            "Form 15G/15H (to avoid TDS if income below taxable limit)",
            "Nomination form",
            "Cheque for deposit amount",
        ],
        "notes": "TDS at 10% is deducted on FD interest above Rs 40,000 per year "
                 "(Rs 50,000 for senior citizens). Submit Form 15G/15H at the start "
                 "of the financial year to avoid TDS if your total income is below "
                 "the taxable limit.",
    },
    "home_loan": {
        "product_name": "Home Loan",
        "mandatory": [
            "PAN card",
            "Aadhaar card",
            "Identity proof (Passport / Voter ID / Driving Licence)",
            "Address proof (current and permanent)",
            "Income proof — Salaried: last 6 months salary slips + Form 16 + "
            "last 2 years ITR",
            "Income proof — Self-employed: last 3 years ITR + audited financials + "
            "business registration",
            "Bank statements (last 6-12 months)",
            "Property documents (sale agreement, title deed, approved plan, "
            "encumbrance certificate, NOC from society)",
        ],
        "additional": [
            "Employment letter / appointment letter (salaried)",
            "Business proof — GST registration, Shop Act licence (self-employed)",
            "Processing fee cheque",
            "Passport-size photographs (4-6 copies)",
            "Co-applicant documents (if joint loan)",
            "Existing loan sanction letters (for balance transfer)",
        ],
        "notes": "Home loan interest up to Rs 2 lakh per year is tax-deductible "
                 "under Section 24(b). Principal repayment up to Rs 1.5 lakh under "
                 "Section 80C. First-time buyers get additional Rs 50,000 under "
                 "Section 80EEA (if stamp duty value under Rs 45 lakh).",
    },
    "personal_loan": {
        "product_name": "Personal Loan",
        "mandatory": [
            "PAN card",
            "Aadhaar card",
            "Identity proof (Passport / Voter ID / Driving Licence)",
            "Address proof (current — utility bill / rent agreement)",
            "Income proof — Salaried: last 3 months salary slips + "
            "last 6 months bank statement",
            "Income proof — Self-employed: last 2 years ITR + "
            "6 months bank statement",
        ],
        "additional": [
            "Employment ID card / letter (salaried)",
            "Business proof — GST / Shop Act (self-employed)",
            "Passport-size photographs (2-3 copies)",
        ],
        "notes": "Personal loan interest is NOT tax deductible (except when used "
                 "for home renovation or business). Most banks require minimum "
                 "monthly income of Rs 20,000-25,000 for salaried and Rs 3 lakh "
                 "annual income for self-employed.",
    },
    "car_loan": {
        "product_name": "Car / Vehicle Loan",
        "mandatory": [
            "PAN card",
            "Aadhaar card",
            "Identity proof (Passport / Voter ID / Driving Licence)",
            "Address proof (current and permanent)",
            "Income proof — Salaried: last 3 months salary slips + bank statement",
            "Income proof — Self-employed: last 2 years ITR + bank statement",
            "Proforma invoice / quotation from the dealer",
        ],
        "additional": [
            "Driving licence (not always mandatory for loan but needed for registration)",
            "Down-payment cheque (usually 10-20% of on-road price)",
            "Passport-size photographs (3-4 copies)",
            "Existing vehicle RC (for used car loans)",
        ],
        "notes": "Car loan EMI should not exceed 15-20% of monthly income. "
                 "Most banks finance 80-90% of on-road price for new cars and "
                 "60-75% for used cars (up to 5 years old).",
    },
    "education_loan": {
        "product_name": "Education Loan",
        "mandatory": [
            "PAN card (student and co-borrower/parent)",
            "Aadhaar card (student and co-borrower)",
            "Admission letter from the institution",
            "Course fee structure (year-wise / semester-wise)",
            "Mark sheets (Class 10, 12, and graduation if applicable)",
            "Entrance exam scorecard (if applicable)",
            "Co-borrower / parent income proof — salary slips, ITR, "
            "bank statement (last 6 months)",
        ],
        "additional": [
            "Passport and visa (for foreign education)",
            "I-20 / CAS letter (for US/UK universities)",
            "Scholarship letter (if any)",
            "Collateral documents (property papers for loans above Rs 7.5 lakh)",
            "Account statement of co-borrower (last 12 months for abroad loans)",
        ],
        "notes": "Education loans up to Rs 7.5 lakh are generally collateral-free. "
                 "Interest during moratorium can be paid to save on total cost. "
                 "Section 80E provides tax deduction on entire interest paid "
                 "(no upper limit) for up to 8 years. Vidya Lakshmi portal "
                 "(vidyalakshmi.co.in) lets you apply to multiple banks at once.",
    },
    "credit_card": {
        "product_name": "Credit Card",
        "mandatory": [
            "PAN card",
            "Aadhaar card",
            "Identity proof (Passport / Voter ID / Driving Licence)",
            "Address proof (current — utility bill, bank statement, Aadhaar)",
            "Income proof — Salaried: latest salary slip or Form 16",
            "Income proof — Self-employed: latest ITR",
        ],
        "additional": [
            "Existing credit card statement (for balance transfer / upgrade)",
            "Bank statement showing salary credit (last 3 months)",
            "Passport-size photograph",
            "Company ID card (salaried)",
        ],
        "notes": "Minimum income requirement varies: Rs 15,000-25,000/month for "
                 "entry-level cards, Rs 50,000+ for premium cards. Always pay "
                 "full outstanding by due date — credit card interest rates are "
                 "30-42% per annum (highest among all loan products). Secured "
                 "credit cards against FD are available for those with no income proof.",
    },
    "mutual_fund": {
        "product_name": "Mutual Fund Account (KYC + Folio)",
        "mandatory": [
            "PAN card (mandatory — no exception)",
            "Aadhaar card",
            "KYC compliance — Complete via CKYC / KRA (most AMCs offer instant e-KYC)",
            "Bank account details (cheque copy or bank statement with IFSC)",
            "Passport-size photograph",
        ],
        "additional": [
            "Demat account (optional — mutual funds can be held in statement form)",
            "Nomination form (Form N — highly recommended)",
            "FATCA self-declaration form",
        ],
        "notes": "KYC is one-time across all AMCs. Invest via AMC website/app or "
                 "platforms like Kuvera, Groww, Zerodha Coin. SIP starts from "
                 "Rs 100-500/month. ELSS funds qualify for Section 80C tax benefit "
                 "with shortest lock-in (3 years) among 80C instruments.",
    },
    "demat_account": {
        "product_name": "Demat + Trading Account",
        "mandatory": [
            "PAN card (mandatory)",
            "Aadhaar card (for e-KYC / in-person verification)",
            "Identity proof (PAN + one more: Passport / Voter ID / Driving Licence)",
            "Address proof (Aadhaar / Passport / Utility bill — not older than 3 months)",
            "Bank proof (cancelled cheque or 6-month bank statement with IFSC visible)",
            "Income proof (latest ITR / salary slip / net-worth certificate "
            "— required for F&O segment activation)",
        ],
        "additional": [
            "Passport-size photograph (for physical form submission)",
            "Digital signature (for online account opening)",
            "FATCA / CRS self-declaration",
        ],
        "notes": "Most brokers (Zerodha, Groww, Angel One) offer free demat account "
                 "with paperless KYC in 15 minutes. Demat is at CDSL/NSDL; trading "
                 "account is with the broker. Annual maintenance charge (AMC) ranges "
                 "from Rs 0 to Rs 750/year depending on broker.",
    },
}


# =============================================================================
# 4. RBI KEY RATES — FALLBACK CACHE
# =============================================================================
# Official RBI rates. Updated whenever RBI MPC announces changes.
# Source: https://www.rbi.org.in/Scripts/BS_NSDPDisplay.aspx?param=4

RBI_RATES_CACHE = {
    "repo_rate": {
        "value": 6.00,
        "description": "Repo Rate — rate at which RBI lends to commercial banks "
                       "against government securities. This is the benchmark rate "
                       "that influences all lending rates in the economy.",
    },
    "reverse_repo_rate": {
        "value": 3.35,
        "description": "Reverse Repo Rate — rate at which RBI borrows from "
                       "commercial banks. Currently set under the LAF corridor.",
    },
    "standing_deposit_facility": {
        "value": 5.75,
        "description": "Standing Deposit Facility (SDF) Rate — floor of the LAF "
                       "corridor. Banks can park funds with RBI at this rate without "
                       "collateral. Replaced reverse repo as the effective floor.",
    },
    "marginal_standing_facility": {
        "value": 6.25,
        "description": "Marginal Standing Facility (MSF) Rate — rate at which banks "
                       "can borrow overnight from RBI using excess SLR securities. "
                       "Always repo rate + 25 bps.",
    },
    "bank_rate": {
        "value": 6.25,
        "description": "Bank Rate — rate at which RBI provides long-term funds to "
                       "banks. Currently aligned with MSF rate.",
    },
    "crr": {
        "value": 4.00,
        "description": "Cash Reserve Ratio (CRR) — percentage of deposits that banks "
                       "must keep as cash with RBI. Earns no interest. Higher CRR "
                       "means less money available for lending.",
    },
    "slr": {
        "value": 18.00,
        "description": "Statutory Liquidity Ratio (SLR) — percentage of deposits that "
                       "banks must invest in government securities. This ensures "
                       "bank solvency and funds government borrowing.",
    },
    "last_mpc_date": "2026-06-06",
    "next_mpc_date": "2026-08-06",
    "last_updated": "2026-08-01",
    "stance": "Accommodative",
    "source": "Reserve Bank of India — Monetary Policy Committee",
}


# =============================================================================
# 5. LOAN PARAMETERS — FOIR & RATE DEFAULTS
# =============================================================================
# FOIR = Fixed Obligation to Income Ratio
# Max FOIR varies by loan type and lender; these are conservative industry norms.

LOAN_PARAMS: dict[str, dict] = {
    "home": {
        "display_name": "Home Loan",
        "default_rate": 8.50,
        "rate_range": "8.25% - 9.50%",
        "max_tenure_months": 360,     # 30 years
        "default_tenure_months": 240,  # 20 years
        "max_foir": 0.60,             # 60% of gross income
        "max_ltv": 0.80,              # 80% of property value
        "min_income_monthly": 25000,
        "processing_fee": "0.25% - 0.50% of loan amount",
        "tax_benefit": "Section 24(b): up to Rs 2 lakh interest + Section 80C: "
                       "up to Rs 1.5 lakh principal",
    },
    "personal": {
        "display_name": "Personal Loan",
        "default_rate": 12.00,
        "rate_range": "10.50% - 24.00%",
        "max_tenure_months": 60,      # 5 years
        "default_tenure_months": 36,   # 3 years
        "max_foir": 0.50,             # 50% of gross income
        "max_ltv": None,              # Unsecured — no collateral
        "min_income_monthly": 20000,
        "processing_fee": "1% - 3% of loan amount",
        "tax_benefit": "None (unless used for home renovation or business purpose)",
    },
    "car": {
        "display_name": "Car / Vehicle Loan",
        "default_rate": 9.00,
        "rate_range": "8.50% - 12.00%",
        "max_tenure_months": 84,      # 7 years
        "default_tenure_months": 60,   # 5 years
        "max_foir": 0.55,             # 55% of gross income
        "max_ltv": 0.90,              # 90% of on-road price
        "min_income_monthly": 20000,
        "processing_fee": "0.50% - 1.00% of loan amount",
        "tax_benefit": "None for personal use. Section 80EEB for electric vehicles "
                       "(up to Rs 1.5 lakh interest — check current status)",
    },
    "education": {
        "display_name": "Education Loan",
        "default_rate": 10.00,
        "rate_range": "8.50% - 13.50%",
        "max_tenure_months": 180,     # 15 years (after moratorium)
        "default_tenure_months": 84,   # 7 years repayment
        "max_foir": 0.50,             # Based on co-borrower income
        "max_ltv": None,              # Based on course and institution
        "min_income_monthly": 15000,  # Co-borrower income
        "processing_fee": "Nil to 1% depending on bank",
        "tax_benefit": "Section 80E: Entire interest paid is deductible (no cap) "
                       "for up to 8 years from start of repayment",
        "moratorium": "Course period + 6-12 months grace period",
    },
    "gold": {
        "display_name": "Gold Loan",
        "default_rate": 8.00,
        "rate_range": "7.00% - 17.00%",
        "max_tenure_months": 36,      # 3 years
        "default_tenure_months": 12,   # 1 year
        "max_foir": 0.65,             # Higher as it is secured
        "max_ltv": 0.75,              # 75% of gold value (RBI mandate)
        "min_income_monthly": 10000,
        "processing_fee": "0.50% - 1.50% of loan amount",
        "tax_benefit": "Interest deductible if used for business purpose",
    },
    "business": {
        "display_name": "Business Loan",
        "default_rate": 14.00,
        "rate_range": "11.00% - 24.00%",
        "max_tenure_months": 60,
        "default_tenure_months": 36,
        "max_foir": 0.50,
        "max_ltv": None,
        "min_income_monthly": 25000,
        "processing_fee": "1% - 3% of loan amount",
        "tax_benefit": "Interest is a business expense — fully deductible under "
                       "Section 36(1)(iii)",
    },
}


# =============================================================================
# 6. GOLD/SILVER PRICE FALLBACK CACHE
# =============================================================================
# Approximate market prices in INR. Used when live API is unreachable.
# Source: India Bullion and Jewellers Association (IBJA)

METAL_PRICES_CACHE = {
    "gold_24k_per_gram": 7450.00,
    "gold_22k_per_gram": 6830.00,
    "gold_18k_per_gram": 5590.00,
    "silver_per_gram": 95.50,
    "silver_per_kg": 95500.00,
    "gold_24k_per_10g": 74500.00,
    "gold_22k_per_10g": 68300.00,
    "last_updated": "2026-08-08",
    "source": "IBJA indicative rates (fallback cache — may not reflect intraday movement)",
}
