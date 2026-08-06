# PRD: VoicePay — AI Voice Banking Agent for Bharat

## 10 Days of Voice Agents — #VoiceForBharat Edition
**Track:** Financial Services  
**Challenge Duration:** 10 Days (Aug 6–15, 2026)  
**Team:** Solo Developer  

---

## 1. Vision & Problem Statement

### The Problem
India has 900M+ mobile users but only 38% of rural households are digitally literate. Despite UPI's massive adoption (12B+ monthly transactions), millions of rural users, senior citizens, and low-literacy populations struggle with text-based banking interfaces. They need financial services but can't navigate apps.

### The Solution
**VoicePay** — an AI-powered voice banking agent that speaks naturally in Indian languages, enabling anyone to check balances, understand transactions, get financial literacy guidance, and navigate UPI/banking services through simple voice conversation.

### Why This Wins
- **Real-world impact**: Solves genuine financial inclusion gap
- **Perfect Murf showcase**: Anisha voice supports 11 Indian locales — one agent, many languages
- **Technical depth**: Function calling, multi-language, financial domain knowledge
- **Demo-friendly**: Clear before/after — "I can't use banking apps" → "I just talked to my bank"

---

## 2. Target Users

| Persona | Description | Language | Key Need |
|---------|-------------|----------|----------|
| Ramesh (55) | Small farmer, Madhya Pradesh | Hindi | Check crop loan status, UPI balance |
| Lakshmi (40) | Street vendor, Chennai | Tamil/English | Daily sales reconciliation, EMI info |
| Priya (28) | First-gen smartphone user, rural Bihar | Hindi | Learn to use UPI, transfer money safely |
| Abdul (62) | Retired teacher, Kerala | Malayalam/English | Pension status, fixed deposit queries |

---

## 3. Core Features (Day 1–10 Roadmap)

### Day 1: Foundation ✅
- Voice agent talks back in Indian English (Anisha voice)
- Basic conversation flow — greets user, understands intent
- Agent persona: "VoicePay" — friendly, patient financial assistant
- Latency measurement logged

### Day 2: Financial Domain Intelligence
- Banking terminology understanding
- UPI flow explanation
- Account balance simulation
- Transaction history narration

### Day 3: Multi-language Support
- Hindi conversation mode (Anisha hi-IN locale)
- Language detection and switching
- Code-mixing support (Hinglish natural)

### Day 4: Function Calling & Tools
- Balance check tool (simulated API)
- Transaction lookup tool
- UPI payment initiation (guided flow)
- Loan EMI calculator

### Day 5: Financial Literacy Module
- Explain savings, FD, RD in simple terms
- Scam awareness (never share OTP)
- Budget planning through conversation
- Government scheme information (PM-KISAN, Jan Dhan)

### Day 6: Context & Memory
- Remember user preferences across turns
- Build user financial profile through conversation
- Personalized advice based on history

### Day 7: Safety & Security
- OTP/PIN never spoken by agent
- Fraud detection patterns
- Secure authentication simulation
- Privacy-first architecture

### Day 8: Advanced UX
- Interruption handling (user cuts in mid-sentence)
- Clarification loops ("Did you mean ₹500 or ₹5000?")
- Graceful error recovery
- Emotional tone detection

### Day 9: Performance & Polish
- Sub-200ms response latency optimization
- Streaming optimization
- Frontend UX polish (visualizer, status indicators)
- Edge case handling

### Day 10: Final Demo & Submission
- Full demo recording
- LinkedIn post with impact narrative
- All features integrated end-to-end
- Documentation complete

---

## 4. Technical Architecture

### System Architecture
```
┌─────────────────────────────────────────────────────────┐
│                    VoicePay System                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ Frontend  │◄──►│ LiveKit Cloud │◄──►│   Backend    │  │
│  │ (Next.js) │    │  (WebRTC)    │    │  (Python)    │  │
│  └──────────┘    └──────────────┘    └──────────────┘  │
│       │                                      │          │
│       │                              ┌───────┴───────┐  │
│       │                              │   Pipeline     │  │
│       │                              ├───────────────┤  │
│       │                              │ Silero VAD    │  │
│       │                              │ Deepgram STT  │  │
│       │                              │ Gemini LLM    │  │
│       │                              │ Murf Falcon   │  │
│       │                              └───────────────┘  │
│       │                                      │          │
│       │                              ┌───────┴───────┐  │
│       │                              │  Tools Layer   │  │
│       │                              ├───────────────┤  │
│       │                              │ balance_check │  │
│       │                              │ transaction   │  │
│       │                              │ upi_guide     │  │
│       │                              │ loan_calc     │  │
│       │                              │ scheme_info   │  │
│       │                              └───────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Voice Configuration
```python
tts = murf.TTS(
    voice="Anisha",           # Widest Indian locale coverage
    style="Conversation",     # Natural, friendly banking tone
    model="falcon-2",         # Ultra-low latency (~55ms)
    sample_rate=24000,        # High quality audio
    locale="en-IN",           # Primary: Indian English
    speed=0,                  # Natural pace
    pitch=0,                  # Natural pitch
)
```

### Voice Justification
**Anisha** is chosen because:
1. Supports 11 Indian locales — future-proof for multilingual expansion
2. Female voice builds trust in financial guidance (studies show higher trust for advisory roles)
3. "Conversation" style is warm and patient — critical for low-literacy users
4. A financial assistant shouldn't sound robotic — Anisha's natural tone reduces anxiety around money topics

### Tech Stack
| Component | Technology | Why |
|-----------|-----------|-----|
| TTS | Murf Falcon 2 (Anisha) | 55ms latency, 11 Indian locales |
| STT | Deepgram nova-3 | Best accuracy for Indian English/Hindi |
| LLM | Google Gemini 3.5 Flash Lite | Fast, cost-effective, good at Hindi |
| VAD | Silero | Accurate turn detection, prewarmed |
| Transport | LiveKit Cloud | WebRTC, handles connectivity |
| Frontend | Next.js 15 + React 19 | Modern, fast, beautiful UI |
| Backend | Python + LiveKit Agents | Industry standard for voice AI |
| Deploy | Railway (backend) + Vercel (frontend) | Easy, scalable |

---

## 5. Agent Persona

**Name:** VoicePay  
**Personality:** Patient, warm, knowledgeable, security-conscious  
**Tone:** Like a helpful bank employee who genuinely wants to help — never condescending, always clear  
**Language:** Starts in Indian English, switches to Hindi/other languages on request  

### System Prompt (Day 1)
```
You are VoicePay, a friendly voice banking assistant designed for India. 
You help people with their banking needs through natural conversation.

Your personality:
- Patient and warm — many users are new to digital banking
- Simple language — avoid jargon, explain everything clearly
- Security-conscious — never ask for or repeat PINs, OTPs, or passwords
- Culturally aware — understand Indian banking context (UPI, NEFT, IMPS)

Current capabilities:
- Explain banking concepts in simple terms
- Guide users through UPI processes
- Answer questions about account types, loans, insurance
- Provide financial literacy tips
- Help with basic calculations (EMI, interest, etc.)

Rules:
- Always greet warmly in the user's language
- If unsure about a financial detail, say so — never make up information
- Remind users to never share OTP/PIN with anyone, including you
- Keep responses concise (2-3 sentences) for natural conversation flow
- If the user speaks Hindi, respond in Hindi
```

---

## 6. Frontend Design

### UX Principles
- **Minimal**: Single "Start Talking" button — no complex UI
- **Accessible**: Large touch targets, high contrast, works on slow connections
- **Visual Feedback**: Audio visualizer shows agent is listening/speaking
- **Trust Signals**: VoicePay branding, security badge, "your conversation is private"

### Branding
- **Name**: VoicePay
- **Tagline**: "Banking by Voice. For Everyone."
- **Colors**: Deep blue (#1e3a5f) + Gold (#f5a623) — trust + prosperity
- **Logo**: Simple mic icon with ₹ symbol

---

## 7. Security Architecture

### Non-negotiables
- No sensitive data (PIN, OTP, card number) ever spoken by agent
- No transaction data stored in conversation logs
- Frontend-to-backend communication only via LiveKit (encrypted WebRTC)
- API keys never exposed to client
- Rate limiting on all endpoints

### Privacy
- Conversations are not recorded or stored (real-time only)
- No PII collection beyond session
- Clear privacy disclaimer before first interaction

---

## 8. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time-to-first-audio | < 200ms | Latency logging |
| Conversation naturalness | Smooth turn-taking | Manual testing |
| Hindi accuracy | 90%+ intent recognition | Test conversations |
| Demo quality | Compelling 2-min video | LinkedIn engagement |
| Challenge compliance | All 10 days submitted | Daily posts |

---

## 9. Competitive Edge

What makes VoicePay stand out in the challenge:
1. **Real problem, real impact** — Financial inclusion is a national priority
2. **Multilingual from Day 1** — Not just English, leverages Anisha's 11 locales
3. **Production-grade security** — Shows maturity beyond a demo
4. **Beautiful frontend** — Custom branding, not generic starter UI
5. **Function calling** — Agent actually does things, not just chat
6. **Progressive complexity** — Each day builds meaningfully on the last
7. **Cultural sensitivity** — Understands Indian banking context deeply

---

## 10. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| LiveKit free tier limits | Use Cloud free tier (sufficient for demo) |
| Deepgram Hindi accuracy | Test extensively, fallback to English |
| Gemini rate limits | Keep prompts concise, cache common responses |
| Murf concurrency (2 for India region) | Use global endpoint for dev |
| 10-day timeline pressure | Day 1 working first, iterate daily |
