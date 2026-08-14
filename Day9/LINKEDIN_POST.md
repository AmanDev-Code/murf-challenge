# LinkedIn Post — VoicePay Day 9

---

## Post (ready to copy-paste)

---

**Day 9 of the 10 Days of Voice Agents challenge.**

I replaced a single 2,900-line AI agent with 6 specialists that hand off to each other mid-conversation.

Here's what that looks like:

→ You call VoicePay and say "calculate my home loan EMI"
→ The Triage agent hears "loan" + "EMI" and routes you to the Calculator specialist
→ Calculator computes your EMI, shows a visual card, then hands you back to Triage
→ You then ask "what documents do I need?" — routed to the Schemes specialist
→ Seamless. One voice call. Three agents. Zero interruption.

**The 6 specialists:**

🎯 Triage — greets, classifies intent, dispatches
🧮 Calculator — EMI, loan eligibility, FD comparison
📋 Schemes — govt yojana, gold rates, RBI rates, document checklists
💰 Accounts — balance, transactions, UPI guides, memory
🔒 Security — credential protection, scam education, data deletion
🚨 Escalation — fraud tickets, regulatory complaints, human handoff

**How it works under the hood:**

LiveKit Agents 1.4 has a native handoff mechanism. When a tool returns a new Agent instance, the session swaps the active agent. Chat context carries over (minus the old system prompt). A shared state dataclass persists customer info, financial results, and security flags across all specialists.

Every handoff fires a data-channel event to the frontend AND inserts a row in Postgres. The dashboard shows live agent utilization, handoff flow graphs (built with React Flow), and a timeline of which specialist handled which part of the call.

**Security hardening (the unglamorous but critical part):**

- API key auth on all 22 routes
- Rate limiting: 60 req/min per IP
- Zod schemas for input validation
- PII scrubbed from tool arguments before DB storage
- CORS locked to known origins

**Stack:**
Murf Falcon-2 TTS · Deepgram Nova-3 STT · Gemini 2.5 Flash Lite · LiveKit Agents 1.4 · Next.js 15 · PostgreSQL 17 · asyncpg · Recharts · React Flow

The monolith worked. But the multi-agent system is testable, observable, and tunable per-specialist. When the gold price API goes down, only the Schemes agent is affected — everyone else keeps working.

Day 10 is tomorrow. Final submission.

#VoiceForBharat #MurfAI #LiveKit #VoiceAgents #MultiAgent #AIEngineering #BuildInPublic

---

## Image suggestions for the post

1. **Primary**: Screenshot of the Agent Flow Graph from the dashboard (the @xyflow/react visualization with colored nodes and animated edges)
2. **Carousel slide 1**: Architecture diagram (Triage at center, 5 specialists around it)
3. **Carousel slide 2**: Split screen — voice call on left, handoff event in dashboard on right
4. **Carousel slide 3**: Terminal showing the 6 agent names importing successfully
5. **Carousel slide 4**: Curl command showing 401 → 200 with API key header
