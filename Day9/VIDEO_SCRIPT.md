# VoicePay Day 9 — Video Demo Script

## Title
**"6 AI Agents That Talk to Each Other: Building a Multi-Agent Voice Banking System"**

## Duration
3:30 – 4:00 minutes

---

## INTRO (0:00 – 0:25)

**[Screen: VoicePay welcome screen with persona picker]**

> "What happens when one AI agent isn't enough? Today I'm going to show you how I built a system where 6 specialized AI agents hand off to each other mid-conversation — all in real-time voice."
>
> "This is VoicePay — a voice banking assistant for India. It uses Murf's Falcon-2 TTS, Deepgram for speech recognition, and Gemini Flash for reasoning. But the magic is in the architecture."

---

## THE ARCHITECTURE (0:25 – 1:00)

**[Screen: Dashboard → Agents tab → Flow Graph]**

> "Here's the system. One Triage agent sits at the center — like a receptionist. It greets you, figures out what you need, and routes you to the right specialist."
>
> "Calculator handles EMIs and loan eligibility. Schemes knows every government yojana. Accounts shows your balance and UPI guides. Security jumps in if you accidentally share credentials. And Escalation creates human-help tickets for fraud cases."
>
> "The handoff is native LiveKit — the LLM literally returns a new Agent instance from a tool call. No HTTP. No queue. Instant."

**[Highlight the flow graph edges animating]**

> "Every handoff is tracked. You can see exactly which agents talked to each other, how many times, and why."

---

## LIVE DEMO — HANDOFF IN ACTION (1:00 – 2:30)

**[Screen: Split — call view on left, dashboard Agents tab on right]**

### Demo 1: Triage → Calculator → back

> "Watch this. I'll ask about a home loan."

**[Speak]:** "I want to take a 20 lakh home loan for 15 years. What will be my EMI?"

**[Wait for response — show canvas card with EMI breakdown]**

> "See that? Triage heard 'loan' and 'EMI', routed to the Calculator specialist. Calculator computed the EMI, showed me the visual card, and now..."

**[Show the handoff event appearing in dashboard in real-time]**

> "...the handoff event just appeared in the dashboard. Triage → Calculator. And when it's done..."

**[Calculator finishes, returns to triage]**

> "Back to Triage. One seamless flow."

### Demo 2: Triage → Schemes

**[Speak]:** "Tell me about Sukanya Samriddhi Yojana"

**[Wait — show scheme card]**

> "Now it went to the Schemes specialist. Different agent, different system prompt, same conversation context."

### Demo 3: Security trigger

**[Speak]:** "My OTP is 4532"

**[Wait — Security agent jumps in with warning]**

> "Boom. Security agent activated instantly. It caught the credential pattern, stopped me, and educated me about scams. No human intervention needed."

---

## THE DASHBOARD (2:30 – 3:15)

**[Screen: Full dashboard]**

### Agents Tab
> "The Agents tab shows everything — utilization per specialist, the interactive flow graph built with React Flow, and a real-time handoff log."

### Security
> "Every API route is now authenticated. Rate limited. Input validated with Zod schemas. PII is scrubbed from tool arguments before they hit the database."

**[Show a curl command returning 401]**

> "Try to hit the API without a key? 401. Try 61 requests in a minute? 429."

---

## WRAP-UP (3:15 – 3:45)

**[Screen: Architecture diagram or README]**

> "Day 9 of the Murf Voice Agent challenge. What started as a single 2900-line agent is now 6 focused specialists with proper handoff, security hardening, and full observability."
>
> "The code is open. The stack is LiveKit Agents, Murf Falcon-2, Deepgram Nova-3, Gemini Flash Lite, Next.js 15, and Postgres."
>
> "If you're building voice agents — don't put everything in one file. Split it. Specialize it. Track it."

**[End card: GitHub link, Murf challenge hashtag]**

---

## B-ROLL SHOTS NEEDED

1. Terminal showing `python -m src.agent dev` starting successfully
2. Browser showing the call connect with persona picker
3. Dashboard Agents tab with flow graph animating
4. Curl command showing 401 → 200 with API key
5. Database query showing `agent_handoffs` table with real data
6. Split screen: voice conversation on left, handoff events appearing on right

## HASHTAGS FOR VIDEO
`#VoiceForBharat` `#MurfAI` `#LiveKit` `#VoiceAgents` `#MultiAgent` `#AIEngineering`
