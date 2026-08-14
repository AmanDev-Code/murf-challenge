# VoicePay Day 9 — Test & Validation Guide

Run these checks top-to-bottom after any code change. Each section is self-contained.

---

## 1. Pre-Flight Checks

```bash
# Verify PostgreSQL is running
pg_isready -h localhost -p 5432
# ✅ Success: "localhost:5432 - accepting connections"
# ❌ Failure: "no response" → start postgres container

# Verify env vars exist
cd /Users/amanahuja/Documents/Murf/Day9/backend/src
cat .env.local | grep -E "LIVEKIT_URL|MURF_API_KEY|DEEPGRAM_API_KEY|GOOGLE_API_KEY" | wc -l
# ✅ Success: 4 (all four present)
# ❌ Failure: < 4 → copy from Day8: cp ../../Day8/backend/src/.env.local .

# Verify Python venv has LiveKit
/Users/amanahuja/Documents/Murf/Day8/backend/.venv/bin/python -c "import livekit.agents; print('LiveKit', livekit.agents.__version__)"
# ✅ Success: "LiveKit 1.x.x"

# Verify Day9 venv symlink (create if missing)
cd /Users/amanahuja/Documents/Murf/Day9/backend
ln -sf /Users/amanahuja/Documents/Murf/Day8/backend/.venv .venv 2>/dev/null
ls -la .venv/bin/python
# ✅ Success: symlink points to Day8 venv
```

---

## 2. Database Schema Verification

```bash
# Run the Day9 migration (idempotent — safe to re-run)
PGPASSWORD=voicepay_dev_2026 psql -h localhost -p 5432 -U voicepay -d voicepay -f /Users/amanahuja/Documents/Murf/Day9/backend/init_day9.sql

# Verify new tables exist
PGPASSWORD=voicepay_dev_2026 psql -h localhost -p 5432 -U voicepay -d voicepay -c "
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('agent_handoffs', 'agent_metrics')
ORDER BY table_name;"
# ✅ Success: Both tables listed
# ❌ Failure: Missing → re-run init_day9.sql

# Verify new columns on call_analytics
PGPASSWORD=voicepay_dev_2026 psql -h localhost -p 5432 -U voicepay -d voicepay -c "
SELECT column_name FROM information_schema.columns
WHERE table_name = 'call_analytics'
AND column_name IN ('handoff_count', 'agents_used', 'primary_agent', 'handoff_timeline')
ORDER BY column_name;"
# ✅ Success: All 4 columns listed
```

---

## 3. Python Import Verification (All 6 Agents)

```bash
cd /Users/amanahuja/Documents/Murf/Day9/backend/src
.venv/bin/python -c "
import sys; sys.path.insert(0, '.')
from state import VoicePayState
from handoff import persist_handoff, persist_session_end_analytics
from agents import TriageAgent, CalculatorAgent, SchemeAgent, AccountsAgent, SecurityAgent, EscalationAgent
from security_middleware import AuthMiddleware, RateLimitMiddleware
from conversation_logger import scrub_content

# Quick state logic test
s = VoicePayState(user_id='test', room_name='test-room')
s.record_handoff('triage', 'calculator', 'EMI request')
assert s.handoff_count == 1
assert s.agents_used() == ['triage', 'calculator']

# PII scrub test
assert 'XXXX-XXXX-XXXX' in scrub_content('aadhaar 1234 5678 9012')

names = [TriageAgent.AGENT_NAME, CalculatorAgent.AGENT_NAME, SchemeAgent.AGENT_NAME,
         AccountsAgent.AGENT_NAME, SecurityAgent.AGENT_NAME, EscalationAgent.AGENT_NAME]
print('All 6 agents:', names)
print('✅ ALL PYTHON IMPORTS PASS')
"
# ✅ Success: "ALL PYTHON IMPORTS PASS"
# ❌ Failure: ModuleNotFoundError → check venv symlink + sys.path
```

---

## 4. Backend Startup Test

```bash
cd /Users/amanahuja/Documents/Murf/Day9/backend/src

# Start agent (will connect to LiveKit — needs valid LIVEKIT_URL)
timeout 10 .venv/bin/python -m src.agent dev 2>&1 | head -30
# ✅ Success: See "prewarm complete — Silero VAD loaded" + no tracebacks
# ❌ Failure: Import errors or "connection refused" → check env vars

# If you just want to verify it starts without actually connecting:
.venv/bin/python -c "
import sys; sys.path.insert(0, '.')
# This imports the full agent module (validates all wiring)
import agent
print('✅ agent.py loads without error — server object created')
print('   Agent name:', 'voicepay')
"
```

---

## 5. Frontend Startup Test

```bash
cd /Users/amanahuja/Documents/Murf/Day9/frontend

# Install deps (including zod)
pnpm install 2>&1 | tail -5
# ✅ Success: "Done in X.Xs"

# Dev server start (check for compile errors)
timeout 15 pnpm dev 2>&1 | grep -E "Ready|error|Error" | head -10
# ✅ Success: "Ready in Xs" or "✓ Starting..."
# ❌ Failure: Compile errors → check the specific file

# Quick TypeScript check on new files only (ignore pre-existing Recharts type issues)
npx tsc --noEmit --skipLibCheck 2>&1 | grep -E "agent-flow-graph|agents-tab|useHandoff|auth\.ts|schemas\.ts" | head -10
# ✅ Success: No output (zero errors in our new files)
# ❌ Failure: Errors shown → fix the specific file
```

---

## 6. API Route Tests (New Agents Endpoints)

Start the frontend first (`pnpm dev`), then test each route:

```bash
BASE="http://localhost:3000"

# 6a. Agent Stats
curl -s "$BASE/api/analytics/agents/stats?days=7" | python3 -m json.tool | head -20
# ✅ Success: JSON with "agents", "flow", "totals" keys
# ❌ Failure: 500 error → check DB connection

# 6b. Agent Handoffs
curl -s "$BASE/api/analytics/agents/handoffs?days=7&limit=10" | python3 -m json.tool | head -15
# ✅ Success: JSON with "handoffs" array (may be empty if no calls yet)

# 6c. Agent Flow
curl -s "$BASE/api/analytics/agents/flow?days=7" | python3 -m json.tool | head -15
# ✅ Success: JSON with "nodes" and "links" arrays

# 6d. Agent Live
curl -s "$BASE/api/analytics/agents/live" | python3 -m json.tool
# ✅ Success: JSON with "active_calls", "active_count", "recent_completed"

# 6e. Agent Timeline (use any room name)
curl -s "$BASE/api/analytics/agents/timeline?room=test-room" | python3 -m json.tool
# ✅ Success: JSON with "room_name", "call", "handoffs" keys
```

---

## 7. Security Validation

```bash
# Set the API key in your .env.local first:
# VOICEPAY_DASHBOARD_KEY=your-secret-key-here

# 7a. Without API key → should get 401 (only when key is configured)
curl -s -o /dev/null -w "%{http_code}" "$BASE/api/analytics/agents/stats"
# ✅ With key configured: 401
# ✅ Without key configured (dev mode): 200 (passthrough)

# 7b. With API key → should get 200
curl -s -o /dev/null -w "%{http_code}" -H "X-API-Key: your-secret-key-here" "$BASE/api/analytics/agents/stats"
# ✅ Success: 200

# 7c. Token endpoint stays public (no auth required)
curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/token" \
  -H "Content-Type: application/json" \
  -d '{"voice":"anisha"}'
# ✅ Success: 200 (token generated)

# 7d. Rate limit test (fire 65 requests rapidly)
for i in $(seq 1 65); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/analytics/agents/stats")
  if [ "$CODE" = "429" ]; then echo "Rate limited at request $i ✅"; break; fi
done
# ✅ Success: "Rate limited at request 61" (or similar)
# Note: Only works when VOICEPAY_DASHBOARD_KEY is set
```

---

## 8. Multi-Agent Handoff Test (Live Call)

### Prerequisites
- Backend running: `cd Day9/backend/src && .venv/bin/python -m src.agent dev`
- Frontend running: `cd Day9/frontend && pnpm dev`
- Open browser to `http://localhost:3000`

### Test Script

| Step | You Say | Expected Behavior | Agent |
|------|---------|-------------------|-------|
| 1 | *(click Start Call)* | Greeting from Anisha | Triage |
| 2 | "Calculate EMI for 10 lakh home loan for 20 years" | Routes to Calculator, computes EMI, shows visual card | Calculator |
| 3 | "What documents do I need for a home loan?" | Routes to Schemes, shows document checklist | Schemes |
| 4 | "Check my balance" | Routes to Accounts, shows demo balance | Accounts |
| 5 | "My OTP is 1234" | Routes to Security, warns about credentials | Security |
| 6 | "Someone stole money from my account" | Routes to Escalation, asks permission to create ticket | Escalation |

### Verify Handoffs in Database

After the test call, check the DB:

```bash
PGPASSWORD=voicepay_dev_2026 psql -h localhost -p 5432 -U voicepay -d voicepay -c "
SELECT from_agent, to_agent, reason, handoff_index, timestamp
FROM agent_handoffs
ORDER BY timestamp DESC
LIMIT 10;"
# ✅ Success: Rows showing triage→calculator, calculator→triage, triage→schemes, etc.

# Check call_analytics was updated
PGPASSWORD=voicepay_dev_2026 psql -h localhost -p 5432 -U voicepay -d voicepay -c "
SELECT room_name, handoff_count, agents_used, primary_agent, outcome
FROM call_analytics
ORDER BY started_at DESC
LIMIT 5;"
# ✅ Success: Row with handoff_count > 0, agents_used array populated
```

---

## 9. PII Scrubbing Verification

After a test call where you mentioned numbers:

```bash
# Check that tool_args are scrubbed in conversation_logs
PGPASSWORD=voicepay_dev_2026 psql -h localhost -p 5432 -U voicepay -d voicepay -c "
SELECT tool_name, tool_args
FROM conversation_logs
WHERE role = 'tool_call' AND tool_args IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;"
# ✅ Success: No raw phone numbers, Aadhaar, or card numbers in tool_args
# ❌ Failure: Raw numbers visible → check conversation_logger.py patch

# Verify the scrub function directly
cd /Users/amanahuja/Documents/Murf/Day9/backend/src
.venv/bin/python -c "
import sys; sys.path.insert(0, '.')
from conversation_logger import scrub_content

tests = [
    ('my otp is 4567', 'XXXXXXXX'),
    ('card 4111222233334444', 'XXXX-XXXX-XXXX-XXXX'),
    ('aadhaar 1234 5678 9012', 'XXXX-XXXX-XXXX'),
    ('email test@example.com', '***@'),
    ('+91 9876543210', 'XXXXXX'),
]
for input_text, expected_fragment in tests:
    result = scrub_content(input_text)
    assert expected_fragment in result, f'FAIL: {input_text} → {result}'
    print(f'  ✅ \"{input_text}\" → \"{result}\"')
print('✅ ALL PII SCRUB TESTS PASS')
"
```

---

## 10. Dashboard Visual Checks

Open `http://localhost:3000/dashboard` in your browser.

| Tab | What to Verify |
|-----|----------------|
| **Overview** | Stats cards, timeline chart, outcome pie chart render without errors |
| **Call History** | Table shows rows (after test calls). Filters work. |
| **Latency** | Percentile cards show data after at least one call |
| **Escalations** | Shows tickets if you triggered an escalation in step 8.6 |
| **Agents** ⭐ | 4 stat cards + utilization bar chart + agent distribution pie + top handoff routes + **interactive flow graph** + recent handoffs table |

### Flow Graph Specific Checks

1. **Graph renders** — you see 6 colored nodes (triage center, 5 around it)
2. **Nodes are draggable** — click and drag any node
3. **Zoom works** — mouse wheel or controls in bottom-left
4. **With data**: edges should appear between nodes that have handoff data, thicker = more traffic
5. **Without data**: placeholder dashed edges show the full topology

---

## 11. Quick Smoke Test (30 seconds, no live call needed)

```bash
cd /Users/amanahuja/Documents/Murf/Day9/backend/src

.venv/bin/python -c "
import sys; sys.path.insert(0, '.')
from state import VoicePayState
from agents import TriageAgent, CalculatorAgent, SchemeAgent, AccountsAgent, SecurityAgent, EscalationAgent

# Simulate a full handoff chain
s = VoicePayState(user_id='smoke-test', room_name='smoke-room')
s.record_handoff('triage', 'calculator', 'EMI for 10L home loan')
s.record_handoff('calculator', 'triage', 'specialist_complete', 'EMI = 8500/mo for 10L at 8.5%')
s.record_handoff('triage', 'schemes', 'user asked about Sukanya Samriddhi')
s.record_handoff('schemes', 'triage', 'specialist_complete', 'Explained SSY scheme')
s.record_handoff('triage', 'security', 'credential pattern detected')
s.record_handoff('security', 'triage', 'specialist_complete', 'Warned user about OTP sharing')

assert s.handoff_count == 6
assert s.agents_used() == ['triage', 'calculator', 'schemes', 'security']
assert len(s.handoff_timeline_json()) == 6
assert s.handoff_timeline_json()[1]['summary'] == 'EMI = 8500/mo for 10L at 8.5%'

print('State Machine:')
print(f'  Handoffs: {s.handoff_count}')
print(f'  Agents Used: {s.agents_used()}')
print(f'  Primary: {s.primary_agent()}')
print(f'  Timeline entries: {len(s.handoff_timeline_json())}')
print()
print('✅ SMOKE TEST PASSED — multi-agent state machine works correctly')
"
```

---

## Summary: What "All Green" Looks Like

| Check | Status |
|-------|--------|
| DB tables exist | ✅ agent_handoffs + agent_metrics + new columns |
| Python imports | ✅ All 6 agents + state + handoff + security |
| Backend starts | ✅ "Silero VAD loaded" + no errors |
| Frontend compiles | ✅ No errors in new files |
| API routes respond | ✅ All 5 return valid JSON |
| Auth works | ✅ 401 without key, 200 with key |
| Handoffs persist | ✅ Rows in agent_handoffs table |
| PII scrubbed | ✅ No raw credentials in tool_args |
| Dashboard renders | ✅ Agents tab with flow graph visible |
| State machine | ✅ Smoke test passes |
