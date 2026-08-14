# VoicePay — Day 9: Multi-Agent Architecture

## 6 Specialized Voice Banking Agents with Handoff Orchestration

Day 9 refactors the monolithic single-agent (2900 lines, 15+ tools) into a **6-specialist multi-agent system** using LiveKit Agents 1.4's native handoff mechanism. Each specialist owns a focused domain with 3-6 tools, hands off cleanly to the next, and emits real-time events to the dashboard.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     AgentSession (shared)                        │
│  STT: Deepgram Nova-3 · LLM: Gemini 2.5 Flash Lite · TTS: Murf │
│  userdata: VoicePayState (shared across all agents)             │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   TriageAgent     │  ← Entry point
                    │   (dispatcher)     │
                    └─────────┬─────────┘
          ┌──────────┬────────┼────────┬──────────┐
          ▼          ▼        ▼        ▼          ▼
   ┌───────────┐ ┌────────┐ ┌──────┐ ┌────────┐ ┌──────────┐
   │Calculator │ │Schemes │ │Accts │ │Security│ │Escalation│
   │ EMI, FD,  │ │ Yojana │ │ Bal, │ │Creds,  │ │ Fraud,   │
   │ Loan Elig │ │ Gold,  │ │ UPI, │ │Forget, │ │ Tickets, │
   │ Reasoning │ │ RBI    │ │Memory│ │Transfer│ │ Helplines│
   └───────────┘ └────────┘ └──────┘ └────────┘ └──────────┘
```

## Key Features

### Multi-Agent Handoff
- **LiveKit native**: `return NewAgent(chat_ctx=...)` from a `@function_tool`
- **Context preserved**: `VoicePayState` dataclass persists across all handoffs
- **Chat history flows**: `chat_ctx.copy(exclude_instructions=True)`
- **Every specialist has `return_to_triage`** to hand back control

### Security Hardening (Day 9 additions)
- `AuthMiddleware` — API key validation on all routes (`X-API-Key` header)
- `RateLimitMiddleware` — 60 req/min per IP (sliding window)
- `lib/auth.ts` — Next.js auth wrapper + rate limiter
- `lib/schemas.ts` — Zod schemas for all input validation
- PII scrubbing on tool_args before DB storage (fixed gap from Day 8)
- CORS restriction to known origins

### Agents Dashboard Tab
- 5 new API routes: `/api/analytics/agents/{stats,handoffs,flow,live,timeline}`
- Agent Utilization bar chart (activations per specialist)
- Handoff Flow visualization (from→to pairs)
- Live handoff event log (recent handoffs table)
- `useHandoffEvents` hook for live call view

### Database Schema (init_day9.sql)
- `agent_handoffs` — per-event handoff log
- `agent_metrics` — daily per-agent aggregation
- `call_analytics` — new columns: `handoff_count`, `agents_used[]`, `primary_agent`, `handoff_timeline`

## Running

```bash
# Backend (from Day9/backend/)
cd src && python -m src.agent dev

# Frontend (from Day9/frontend/)
pnpm install && pnpm dev

# Database migration (run once)
PGPASSWORD=voicepay_dev_2026 psql -h localhost -p 5432 -U voicepay -d voicepay -f init_day9.sql
```

## File Structure (new files)

```
backend/src/
├── agents/
│   ├── __init__.py           # Re-exports all agent classes
│   ├── base.py               # BaseVoicePayAgent (shared: canvas, handoff, return_to_triage)
│   ├── triage.py             # TriageAgent (dispatcher + route_to_* tools)
│   ├── calculator.py         # CalculatorAgent (EMI, FD, loan, reasoning)
│   ├── schemes.py            # SchemeAgent (yojana, gold, RBI, documents)
│   ├── accounts.py           # AccountsAgent (balance, UPI, memory)
│   ├── security_agent.py     # SecurityAgent (credentials, forget, transfer)
│   └── escalation_agent.py   # EscalationAgent (fraud, regulatory, tickets)
├── state.py                  # VoicePayState dataclass
├── handoff.py                # DB persistence for handoff events
├── security_middleware.py    # FastAPI auth + rate limiting
└── agent.py                  # REFACTORED: session wiring only

frontend/
├── app/api/analytics/agents/ # 5 new API routes
├── components/dashboard/agents-tab.tsx
├── hooks/useHandoffEvents.ts
├── lib/auth.ts               # API key validation
└── lib/schemas.ts            # Zod input schemas
```

## Super Enhancement Features

1. **Per-specialist voice tuning** — CalculatorAgent speaks slower for number clarity
2. **Proactive suggestions** — TriageAgent suggests related actions on return
3. **Cross-specialist security warnings** — SecurityAgent sets flags, TriageAgent warns
4. **Agent-context-aware escalation** — EscalationAgent includes handoff_history in tickets
5. **Graceful degradation** — API failures isolate to one specialist only
6. **Specialist-specific memory** — AccountsAgent namespaces saved facts
7. **Analytics-driven prompt tuning** — dashboard shows high-return-to-triage rates
