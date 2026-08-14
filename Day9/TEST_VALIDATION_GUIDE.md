# VoicePay Day 9 — Multi-Agent System Test & Validation Guide

> Run top-to-bottom. Each section is independent after Pre-flight passes.
> Estimated total time: ~20 minutes (manual), ~5 minutes (automated checks only).

---

## 1. Pre-flight Checks

### 1.1 Required Environment Variables

The backend reads from `.env` in the working directory. Verify these are set:

```bash
# From Day9/backend/src/ (or wherever .env lives)
cd /Users/amanahuja/Documents/Murf/Day9/backend/src

# Core (required for agent to start)
echo "LIVEKIT_URL=$LIVEKIT_URL"
echo "LIVEKIT_API_KEY=$LIVEKIT_API_KEY"
echo "LIVEKIT_API_SECRET=$LIVEKIT_API_SECRET"
echo "DEEPGRAM_API_KEY=$DEEPGRAM_API_KEY"
echo "GOOGLE_API_KEY=$GOOGLE_API_KEY"

# Database (uses default if not set)
echo "DATABASE_URL=${DATABASE_URL:-postgresql://voicepay:voicepay_dev_2026@localhost:5432/voicepay}"

# Security (optional — empty = dev mode passthrough)
echo "VOICEPAY_DASHBOARD_KEY=$VOICEPAY_DASHBOARD_KEY"
```

**SUCCESS**: All core vars print non-empty values.
**FAILURE**: Any core var is empty — agent will crash on first call or fail STT/LLM/TTS.

### 1.2 PostgreSQL Running

```bash
pg_isready -h localhost -p 5432 -U voicepay
```

**SUCCESS**: `localhost:5432 - accepting connections`
**FAILURE**: `no response` or `could not connect` — start Postgres first:
```bash
# If using Docker:
cd /Users/amanahuja/Documents/Murf/Day9/backend && docker compose up -d
# If using Homebrew:
brew services start postgresql@17
```

### 1.3 Database Exists

```bash
PGPASSWORD=voicepay_dev_2026 psql -h localhost -p 5432 -U voicepay -d voicepay -c "SELECT 1;"
```

**SUCCESS**: Returns `1` with no error.
**FAILURE**: `FATAL: database "voicepay" does not exist` — create it:
```bash
PGPASSWORD=voicepay_dev_2026 createdb -h localhost -p 5432 -U voicepay voicepay
```

### 1.4 Python venv Active

```bash
source /Users/amanahuja/Documents/Murf/Day8/backend/.venv/bin/activate
python --version  # Should be 3.10+
python -c "import livekit.agents; print(livekit.agents.__version__)"
```

**SUCCESS**: Python 3.10+ and livekit-agents prints `1.4.x`.
**FAILURE**: ModuleNotFoundError — install deps:
```bash
cd /Users/amanahuja/Documents/Murf/Day9/backend
pip install -e .
```

### 1.5 Node/pnpm Available

```bash
node --version   # Should be 18+
pnpm --version   # Should be 8+
```

**SUCCESS**: Both print version numbers.
**FAILURE**: Install via `brew install node pnpm` or `corepack enable`.

### 1.6 Ports Free

```bash
lsof -i :5432 | head -3   # Postgres
lsof -i :3000 | head -3   # Next.js
lsof -i :8080 | head -3   # LiveKit agent worker (if applicable)
```

**SUCCESS**: Port 5432 shows `postgres`, ports 3000 and 8080 are free (or show your dev servers).
**FAILURE**: Kill conflicting processes with `kill -9 <PID>`.

---

## 2. Backend Startup Verification

```bash
source /Users/amanahuja/Documents/Murf/Day8/backend/.venv/bin/activate
cd /Users/amanahuja/Documents/Murf/Day9/backend/src
python -m src.agent dev
```

**SUCCESS** (within 5 seconds):
```
INFO  voicepay - VoicePay multi-agent system starting...
INFO  livekit.agents - Worker registered
INFO  livekit.agents - Agent ready, waiting for jobs...
```
No `ImportError`, no `ModuleNotFoundError`, no traceback.

**FAILURE patterns**:
| Error | Fix |
|-------|-----|
| `ModuleNotFoundError: No module named 'agents'` | You're running from wrong dir. Must be in `backend/src/`. |
| `ModuleNotFoundError: No module named 'livekit'` | Venv not activated or deps not installed. |
| `ssl.SSLCertVerificationError` | `pip install certifi` — agent.py should auto-patch this. |
| `Connection refused` on DB | Postgres not running (Section 1.2). |
| `LIVEKIT_URL not set` | Missing `.env` — copy from Day8 or set vars. |

**Quick syntax-only check** (no network needed):
```bash
cd /Users/amanahuja/Documents/Murf/Day9/backend/src
python -c "
from agents import TriageAgent, CalculatorAgent, SchemeAgent, AccountsAgent, SecurityAgent, EscalationAgent
from state import VoicePayState
from handoff import persist_handoff, persist_session_end_analytics, update_agent_metrics
from security_middleware import AuthMiddleware, RateLimitMiddleware
from conversation_logger import ConversationLogger, scrub_content
print('All Day 9 modules import successfully')
"
```

**SUCCESS**: Prints confirmation.
**FAILURE**: Import error with specific module name — fix that module.

---

## 3. Frontend Startup Verification

```bash
cd /Users/amanahuja/Documents/Murf/Day9/frontend
pnpm install   # First time only
pnpm dev
```

**SUCCESS** (within 10 seconds):
```
  ▲ Next.js 15.x.x
  - Local:        http://localhost:3000
  - Ready in Xs

 ✓ Compiled /dashboard in Xs
```
No TypeScript errors, no module resolution failures.

**FAILURE patterns**:
| Error | Fix |
|-------|-----|
| `Module not found: @xyflow/react` | `pnpm install` — dependency not installed. |
| `Module not found: recharts` | Same — `pnpm install`. |
| Type errors in `agents-tab.tsx` | Check `@xyflow/react` version is `^12.10.0` in package.json. |
| `EADDRINUSE :3000` | Another dev server running — kill it or use `pnpm dev -p 3001`. |

**Build check** (stricter than dev mode):
```bash
cd /Users/amanahuja/Documents/Murf/Day9/frontend
pnpm build
```

**SUCCESS**: `Route (app) ... ✓` for all pages, exit 0.
**FAILURE**: Any type error or build failure — fix before proceeding.

---

## 4. Database Schema Verification

Run the Day 9 migration (idempotent — safe to re-run):

```bash
PGPASSWORD=voicepay_dev_2026 psql -h localhost -p 5432 -U voicepay -d voicepay -f /Users/amanahuja/Documents/Murf/Day9/backend/init_day9.sql
```

### 4.1 Verify `agent_handoffs` Table

```bash
PGPASSWORD=voicepay_dev_2026 psql -h localhost -p 5432 -U voicepay -d voicepay -c "
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'agent_handoffs'
ORDER BY ordinal_position;
"
```

**SUCCESS**: Shows columns: `id`, `session_id`, `room_name`, `user_id`, `from_agent`, `to_agent`, `reason`, `context_summary`, `handoff_index`, `timestamp`.

### 4.2 Verify `agent_metrics` Table

```bash
PGPASSWORD=voicepay_dev_2026 psql -h localhost -p 5432 -U voicepay -d voicepay -c "
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'agent_metrics'
ORDER BY ordinal_position;
"
```

**SUCCESS**: Shows columns: `id`, `date`, `agent_name`, `total_activations`, `avg_duration_ms`, `tool_calls`, `tool_errors`, `handoffs_in`, `handoffs_out`.

### 4.3 Verify `call_analytics` Day 9 Columns

```bash
PGPASSWORD=voicepay_dev_2026 psql -h localhost -p 5432 -U voicepay -d voicepay -c "
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'call_analytics'
  AND column_name IN ('handoff_count', 'agents_used', 'primary_agent', 'handoff_timeline')
ORDER BY column_name;
"
```

**SUCCESS**: Returns 4 rows:
```
 agents_used      | ARRAY
 handoff_count    | integer
 handoff_timeline | jsonb
 primary_agent    | text
```

**FAILURE**: 0 rows or missing columns — run `init_day9.sql` again. If `call_analytics` table itself doesn't exist, run `init_day8.sql` first.

### 4.4 Verify Indexes

```bash
PGPASSWORD=voicepay_dev_2026 psql -h localhost -p 5432 -U voicepay -d voicepay -c "
SELECT indexname FROM pg_indexes
WHERE tablename IN ('agent_handoffs', 'agent_metrics', 'call_analytics')
  AND indexname LIKE 'idx_%'
ORDER BY indexname;
"
```

**SUCCESS**: Should show at minimum:
- `idx_handoffs_room`
- `idx_handoffs_session`
- `idx_handoffs_agents`
- `idx_handoffs_time`
- `idx_agent_metrics_date`
- `idx_agent_metrics_name`
- `idx_call_analytics_agents`

---

## 5. API Route Tests

> **Prerequisite**: Frontend must be running (`pnpm dev` on port 3000).
> These routes hit the DB directly from Next.js API routes.

### 5.1 `/api/analytics/agents/stats` — Agent Utilization Stats

```bash
curl -s http://localhost:3000/api/analytics/agents/stats?days=7 | python3 -m json.tool
```

**SUCCESS**: Returns JSON with structure:
```json
{
  "period_days": 7,
  "agents": [],
  "flow": [],
  "totals": {
    "total_calls": 0,
    "avg_handoffs_per_call": 0,
    "max_handoffs": 0,
    "avg_agents_per_call": 0
  }
}
```
(Empty arrays are fine if no calls have been made yet — the key is HTTP 200 and valid JSON.)

**FAILURE**: HTTP 500 with `"Failed to fetch agent stats"` — check DB connection.

### 5.2 `/api/analytics/agents/handoffs` — Recent Handoff Events

```bash
curl -s "http://localhost:3000/api/analytics/agents/handoffs?days=7&limit=10" | python3 -m json.tool
```

**SUCCESS**: Returns:
```json
{
  "period_days": 7,
  "total": 0,
  "handoffs": []
}
```

**FAILURE**: 500 error — likely `agent_handoffs` table doesn't exist.

### 5.3 `/api/analytics/agents/flow` — Handoff Flow Graph Data

```bash
curl -s http://localhost:3000/api/analytics/agents/flow?days=7 | python3 -m json.tool
```

**SUCCESS**: Returns:
```json
{
  "period_days": 7,
  "nodes": [],
  "links": []
}
```

**FAILURE**: 500 — check that `agent_handoffs` table has proper indexes.

### 5.4 `/api/analytics/agents/live` — Active Calls

```bash
curl -s http://localhost:3000/api/analytics/agents/live | python3 -m json.tool
```

**SUCCESS**: Returns:
```json
{
  "active_calls": [],
  "active_count": 0,
  "recent_completed": [],
  "timestamp": "2026-08-14T..."
}
```

**FAILURE**: 500 — check that `call_analytics` table has the Day 9 columns (`primary_agent`, `agents_used`, etc.).

### 5.5 `/api/analytics/agents/timeline` — Per-Call Handoff Timeline

```bash
# This route expects a room_name parameter (via path or query).
# Without existing data, test with a dummy room name:
curl -s "http://localhost:3000/api/analytics/agents/timeline?room=test-room-123" | python3 -m json.tool
```

**SUCCESS**: Returns:
```json
{
  "room_name": null,
  "call": null,
  "handoffs": [],
  "total_handoffs": 0
}
```
(Note: This route uses dynamic params — the exact response structure may vary. HTTP 200 with JSON = pass.)

**FAILURE**: 500 or 400 error — check the route signature matches the request pattern.

### 5.6 Batch Verification (all 5 in one shot)

```bash
echo "--- Stats ---" && curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/analytics/agents/stats
echo ""
echo "--- Handoffs ---" && curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/analytics/agents/handoffs
echo ""
echo "--- Flow ---" && curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/analytics/agents/flow
echo ""
echo "--- Live ---" && curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/analytics/agents/live
echo ""
echo "--- Timeline ---" && curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/analytics/agents/timeline?room=test"
echo ""
```

**SUCCESS**: All print `200`.
**FAILURE**: Any non-200 — investigate that specific route.

---

## 6. Multi-Agent Handoff Test (End-to-End)

> **Prerequisites**: Backend agent running, frontend running, LiveKit Cloud reachable.

### 6.1 Connect via Browser

1. Open `http://localhost:3000`
2. Grant microphone permission
3. Click "Start Call" / connect button
4. Wait for agent greeting: "Namaste! Main Anisha, VoicePay se..."

**SUCCESS**: Agent greets you within 3-5 seconds.
**FAILURE**: No audio / "Connecting..." hangs — check LIVEKIT_URL and agent logs.

### 6.2 Trigger Each Specialist

Say these exact phrases and observe the agent behavior:

| # | Say This | Expected Specialist | Confirmation Signal |
|---|----------|-------------------|-------------------|
| 1 | "I want to calculate my EMI for a home loan" | **Calculator** | Agent says something about loan amount/tenure/rate |
| 2 | "Take me back" or wait for calculation to complete | **Triage** (return) | Agent offers suggestions or asks "anything else?" |
| 3 | "What government schemes am I eligible for?" | **Schemes** | Agent asks about income/category/state |
| 4 | "Go back to main menu" | **Triage** (return) | Returns to triage |
| 5 | "What is my account balance?" | **Accounts** | Agent asks for verification or shows balance |
| 6 | "I think someone hacked my account" | **Escalation** | Agent escalates, asks for details about fraud |
| 7 | "I want to change my PIN" | **Security** | Agent handles credential-related request |

### 6.3 Verify Handoffs in Database

After the call ends (or during), check the DB:

```bash
PGPASSWORD=voicepay_dev_2026 psql -h localhost -p 5432 -U voicepay -d voicepay -c "
SELECT id, from_agent, to_agent, reason, handoff_index, timestamp
FROM agent_handoffs
ORDER BY timestamp DESC
LIMIT 20;
"
```

**SUCCESS**: Shows rows matching your conversation flow. Example:
```
 id | from_agent | to_agent   | reason                          | handoff_index
----+------------+------------+---------------------------------+--------------
  1 | triage     | calculator | User wants financial calculation | 0
  2 | calculator | triage     | Calculation complete, returning  | 1
  3 | triage     | schemes    | User asking about schemes/rates  | 2
```

**FAILURE**: Empty table — check backend logs for `persist_handoff failed` warnings.

### 6.4 Verify call_analytics Updated

```bash
PGPASSWORD=voicepay_dev_2026 psql -h localhost -p 5432 -U voicepay -d voicepay -c "
SELECT room_name, handoff_count, agents_used, primary_agent, handoff_timeline
FROM call_analytics
ORDER BY started_at DESC
LIMIT 5;
"
```

**SUCCESS**: Latest row shows `handoff_count > 0`, `agents_used` contains multiple agents, `handoff_timeline` is non-empty JSONB.

**FAILURE**: `handoff_count = 0` and `agents_used = '{}'` — the `persist_session_end_analytics` isn't being called at session shutdown.

### 6.5 Verify Data Channel Events (Browser Console)

1. Open browser DevTools → Console
2. During a call, after a handoff occurs, look for:
   ```
   [voicepay.handoff] {"from_agent":"triage","to_agent":"calculator","reason":"..."}
   ```
   (The `useHandoffEvents` hook listens on topic `voicepay.handoff`.)

**SUCCESS**: JSON messages appear in console on each handoff.
**FAILURE**: No messages — check if the agent is publishing to the data channel.

---

## 7. Security Validation

### 7.1 API Key Auth (Backend — FastAPI)

> Only applies if `VOICEPAY_DASHBOARD_KEY` is set in the environment.

```bash
# Set a test key
export VOICEPAY_DASHBOARD_KEY="test-key-123"
# Restart the backend agent with this key set

# Test WITHOUT key (should be rejected if key is configured):
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health
# Health is public — should be 200

# Test a protected route without key:
curl -s http://localhost:8080/api/escalations -H "Content-Type: application/json"
# Should be 401 if VOICEPAY_DASHBOARD_KEY is set

# Test WITH correct key:
curl -s http://localhost:8080/api/escalations -H "X-API-Key: test-key-123"
# Should be 200 (or valid response)
```

**SUCCESS**:
- `/health` → 200 (always public)
- Protected route without key → 401 `{"detail":"Invalid or missing API key"}`
- Protected route with correct key → 200

**FAILURE**: Everything returns 200 even without key — check that `VOICEPAY_DASHBOARD_KEY` is actually set (not empty string).

### 7.2 API Key Auth (Frontend — Next.js)

> The frontend `lib/auth.ts` checks `VOICEPAY_DASHBOARD_KEY` env var.
> In dev mode (no key configured), all requests pass through.

```bash
# Set key in frontend env:
echo "VOICEPAY_DASHBOARD_KEY=test-key-123" >> /Users/amanahuja/Documents/Murf/Day9/frontend/.env.local
# Restart frontend (pnpm dev)

# Test without key — should get 401:
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/analytics/agents/stats

# Test with key — should get 200:
curl -s -o /dev/null -w "%{http_code}" -H "X-API-Key: test-key-123" http://localhost:3000/api/analytics/agents/stats

# Token route should always be public:
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/token
```

**SUCCESS**: Stats without key → 401, with key → 200, token → 200.
**FAILURE**: All return 200 — check that `withAuth` or `withProtection` wraps the route handlers. (Note: the current Day 9 agents routes do NOT use `withAuth` — they connect directly to DB. This is a known gap for local dev convenience.)

### 7.3 Rate Limiting

```bash
# Rapid-fire 65 requests (limit is 60/min):
for i in $(seq 1 65); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/escalations -H "X-API-Key: test-key-123")
  if [ "$CODE" = "429" ]; then
    echo "Rate limited at request #$i"
    break
  fi
done
```

**SUCCESS**: Prints `Rate limited at request #61` (or close to 60).
**FAILURE**: All 65 succeed — rate limiter not attached to the FastAPI app. Check that `RateLimitMiddleware` is added in the app setup.

### 7.4 Dev Mode Passthrough

```bash
# Unset the key (simulates dev mode):
unset VOICEPAY_DASHBOARD_KEY
# Restart backend

# All routes should pass without auth:
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/escalations
```

**SUCCESS**: Returns 200 (dev mode passthrough when no key configured).

---

## 8. Dashboard Visual Check

> **Prerequisites**: Frontend running, at least one call completed (or seed data).

### 8.1 Navigate to Dashboard

Open: `http://localhost:3000/dashboard`

**SUCCESS**: Page loads with 5 tabs visible:
- Overview
- Call History
- Latency
- Escalations
- **Agents** (new in Day 9)

### 8.2 Agents Tab Content Check

Click the "Agents" tab (or navigate to `http://localhost:3000/dashboard?tab=agents`).

**Verify these elements render**:

| # | Element | What to Look For |
|---|---------|-----------------|
| 1 | Period selector | Buttons: "Today", "7d", "14d", "30d" — clicking changes data |
| 2 | Summary stat cards | 4 cards: "Multi-Agent Calls", "Avg Handoffs/Call", "Max Handoffs", "Avg Agents/Call" |
| 3 | Agent Utilization bar chart | Colored bars per agent (or empty state if no data) |
| 4 | Agent Distribution pie chart | Pie chart with agent colors |
| 5 | Top Handoff Routes | Table with `from → to` pairs and counts |
| 6 | Agent Handoff Graph | **Interactive flow graph** with nodes for each agent (Section 10) |
| 7 | Recent Handoffs table | Table with columns: Time, From, To, Reason, Room |

**SUCCESS**: All 7 elements visible. Empty states show "No handoff data yet" / "No handoff events recorded yet" messages (not broken UI).

**FAILURE**: Blank page or console errors — check:
- `@xyflow/react` installed (`pnpm list @xyflow/react`)
- `recharts` installed (`pnpm list recharts`)
- API routes returning 200 (Section 5)

### 8.3 Other Tabs Still Work

Quick-check that Day 9 didn't break existing tabs:

| Tab | URL | Should Show |
|-----|-----|-------------|
| Overview | `/dashboard?tab=overview` | Stats cards + charts |
| Call History | `/dashboard?tab=calls` | Table of past calls |
| Latency | `/dashboard?tab=latency` | Latency breakdown charts |
| Escalations | `/dashboard?tab=escalations` | Ticket list |

**SUCCESS**: All tabs render without console errors.

---

## 9. PII Scrubbing Test

### 9.1 Unit Test — scrub_content Function

```bash
source /Users/amanahuja/Documents/Murf/Day8/backend/.venv/bin/activate
cd /Users/amanahuja/Documents/Murf/Day9/backend/src
python3 -c "
from conversation_logger import scrub_content

# Test cases
tests = [
    ('My OTP is 482956', True),         # Should scrub digits after OTP
    ('PIN: 1234', True),                 # Should scrub PIN
    ('Aadhaar 1234 5678 9012', True),    # Should become XXXX-XXXX-XXXX
    ('Card 4111 1111 1111 1111', True),  # Should become XXXX-XXXX-XXXX-XXXX
    ('+919876543210', True),             # Phone — partial mask
    ('ABCDE1234F', True),               # PAN number
    ('test@example.com', True),          # Email
    ('account number: 12345678901234', True),  # Account number
    ('Hello how are you', False),        # No PII — should be unchanged
]

all_pass = True
for text, should_change in tests:
    result = scrub_content(text)
    changed = (result != text)
    status = 'PASS' if changed == should_change else 'FAIL'
    if status == 'FAIL':
        all_pass = False
    print(f'  [{status}] Input: \"{text}\"')
    print(f'         Output: \"{result}\"')
    print()

print('=' * 50)
print('ALL PII SCRUB TESTS PASSED' if all_pass else 'SOME PII SCRUB TESTS FAILED')
"
```

**SUCCESS**: All tests show `[PASS]`, sensitive data is replaced with `XXXXXXXX` / `XXXX-XXXX-XXXX` patterns.
**FAILURE**: Any `[FAIL]` — check the regex patterns in `_PII_SCRUB_RULES`.

### 9.2 Verify tool_args Scrubbed in Database

After making a call where you mention an OTP or PIN number (e.g., "My OTP is 123456"):

```bash
PGPASSWORD=voicepay_dev_2026 psql -h localhost -p 5432 -U voicepay -d voicepay -c "
SELECT id, role, content, tool_args
FROM conversation_logs
WHERE role = 'tool_call'
ORDER BY created_at DESC
LIMIT 10;
"
```

**SUCCESS**: `tool_args` column shows scrubbed values like:
```json
{"otp": "otp: XXXXXXXX", "account": "account number: XXXXXXXX"}
```
No raw digits visible in tool_args for sensitive fields.

**FAILURE**: Raw PII visible in `tool_args` — the `log_tool_call` method isn't applying `scrub_content` to argument values.

### 9.3 Verify User Messages Scrubbed

```bash
PGPASSWORD=voicepay_dev_2026 psql -h localhost -p 5432 -U voicepay -d voicepay -c "
SELECT id, role, content
FROM conversation_logs
WHERE role = 'user'
  AND (content LIKE '%XXXX%' OR content LIKE '%otp%' OR content LIKE '%pin%')
ORDER BY created_at DESC
LIMIT 5;
"
```

**SUCCESS**: Content shows scrubbed patterns (`XXXXXXXX`) rather than actual digits.

---

## 10. Flow Graph Test (@xyflow/react)

### 10.1 Component Renders

1. Navigate to `http://localhost:3000/dashboard?tab=agents`
2. Scroll to the "Agent Handoff Graph" section

**SUCCESS**: You see:
- A dark container with title "Agent Handoff Graph"
- 6 agent nodes arranged in a hub-and-spoke layout:
  - **Center**: Triage (orange border)
  - **Ring**: Calculator (blue), Schemes (green), Accounts (purple), Security (red), Escalation (orange-red)
- Each node shows agent name + description + activation count
- Edges (arrows) between nodes (dashed if no data, solid with counts if data exists)
- Zoom controls (+ / - / fit) in bottom-left corner
- Nodes are draggable

**FAILURE**:
- Blank white/black box — `@xyflow/react` CSS not loading. Check that `import '@xyflow/react/dist/style.css'` is present in `agent-flow-graph.tsx`.
- "Module not found" — `pnpm install` needed.
- Nodes pile up at (0,0) — layout calculation issue in `buildGraph()`.

### 10.2 Interactivity

- **Drag** a node → it should move smoothly
- **Scroll** to zoom → graph zooms in/out
- **Click** fit-view control → graph re-centers
- **Hover** over a node → slight scale-up animation (`hover:scale-105`)

### 10.3 With Real Data

After making calls with handoffs, refresh the Agents tab:

```bash
# Seed some test handoff data for visual verification:
PGPASSWORD=voicepay_dev_2026 psql -h localhost -p 5432 -U voicepay -d voicepay -c "
INSERT INTO agent_handoffs (room_name, from_agent, to_agent, reason, handoff_index, timestamp)
VALUES
  ('test-room-viz-1', 'triage', 'calculator', 'EMI calculation', 0, NOW() - INTERVAL '1 hour'),
  ('test-room-viz-1', 'calculator', 'triage', 'Done', 1, NOW() - INTERVAL '55 minutes'),
  ('test-room-viz-2', 'triage', 'schemes', 'Scheme query', 0, NOW() - INTERVAL '30 minutes'),
  ('test-room-viz-2', 'schemes', 'triage', 'Done', 1, NOW() - INTERVAL '25 minutes'),
  ('test-room-viz-3', 'triage', 'accounts', 'Balance check', 0, NOW() - INTERVAL '20 minutes'),
  ('test-room-viz-3', 'accounts', 'triage', 'Done', 1, NOW() - INTERVAL '15 minutes'),
  ('test-room-viz-4', 'triage', 'security', 'PIN change', 0, NOW() - INTERVAL '10 minutes'),
  ('test-room-viz-4', 'triage', 'escalation', 'Fraud report', 0, NOW() - INTERVAL '5 minutes');
"
```

Refresh the page. The graph should now show:
- Solid arrows from triage to each specialist with `Nx` labels
- Return arrows (lighter opacity) back to triage
- Animated edges on high-traffic routes (value > 5)

### 10.4 Cleanup Test Data

```bash
PGPASSWORD=voicepay_dev_2026 psql -h localhost -p 5432 -U voicepay -d voicepay -c "
DELETE FROM agent_handoffs WHERE room_name LIKE 'test-room-viz-%';
"
```

---

## Quick Reference: Complete Automated Smoke Test

Run this single script to verify all non-interactive checks pass:

```bash
#!/usr/bin/env bash
set -e

echo "=== VoicePay Day 9 Smoke Test ==="
echo ""

# 1. DB connectivity
echo -n "[1/6] PostgreSQL... "
PGPASSWORD=voicepay_dev_2026 psql -h localhost -p 5432 -U voicepay -d voicepay -c "SELECT 1;" > /dev/null 2>&1 && echo "OK" || echo "FAIL"

# 2. Day 9 tables exist
echo -n "[2/6] Day 9 schema... "
PGPASSWORD=voicepay_dev_2026 psql -h localhost -p 5432 -U voicepay -d voicepay -c "
SELECT COUNT(*) FROM information_schema.tables
WHERE table_name IN ('agent_handoffs', 'agent_metrics');" -t | grep -q "2" && echo "OK (2 tables)" || echo "FAIL"

# 3. Day 9 columns on call_analytics
echo -n "[3/6] call_analytics columns... "
PGPASSWORD=voicepay_dev_2026 psql -h localhost -p 5432 -U voicepay -d voicepay -c "
SELECT COUNT(*) FROM information_schema.columns
WHERE table_name = 'call_analytics'
  AND column_name IN ('handoff_count','agents_used','primary_agent','handoff_timeline');" -t | grep -q "4" && echo "OK (4 columns)" || echo "FAIL"

# 4. Python imports
echo -n "[4/6] Backend imports... "
source /Users/amanahuja/Documents/Murf/Day8/backend/.venv/bin/activate 2>/dev/null
cd /Users/amanahuja/Documents/Murf/Day9/backend/src
python3 -c "
from agents import TriageAgent, CalculatorAgent, SchemeAgent, AccountsAgent, SecurityAgent, EscalationAgent
from state import VoicePayState
from handoff import persist_handoff
from security_middleware import AuthMiddleware, RateLimitMiddleware
from conversation_logger import scrub_content
" 2>/dev/null && echo "OK" || echo "FAIL"

# 5. PII scrubbing works
echo -n "[5/6] PII scrubbing... "
python3 -c "
from conversation_logger import scrub_content
assert scrub_content('OTP is 482956') != 'OTP is 482956'
assert scrub_content('Hello world') == 'Hello world'
assert 'XXXX' in scrub_content('1234 5678 9012')
" 2>/dev/null && echo "OK" || echo "FAIL"

# 6. Frontend compiles (if node available)
echo -n "[6/6] Frontend types... "
cd /Users/amanahuja/Documents/Murf/Day9/frontend
if command -v pnpm &> /dev/null; then
  pnpm exec tsc --noEmit 2>/dev/null && echo "OK" || echo "FAIL (type errors)"
else
  echo "SKIP (pnpm not found)"
fi

echo ""
echo "=== Done ==="
```

---

## Troubleshooting Quick Reference

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Agent starts but no audio | Deepgram key invalid | Check `DEEPGRAM_API_KEY` |
| Agent speaks but doesn't understand | STT not connected | Check LiveKit room join logs |
| Handoffs happen but DB empty | `persist_handoff` failing silently | Check backend logs for "persist_handoff failed" |
| Dashboard shows 500 on agents endpoints | DB not migrated | Run `init_day9.sql` |
| Flow graph blank (no nodes) | `@xyflow/react` CSS missing | Verify import in `agent-flow-graph.tsx` |
| Rate limiter never triggers | Middleware not added to app | Check FastAPI `app.add_middleware(RateLimitMiddleware)` |
| Auth passes without key | `VOICEPAY_DASHBOARD_KEY` empty | Set the env var to a non-empty string |
| TypeScript errors on build | Missing `@xyflow/react` types | `pnpm add -D @types/react` (usually not needed with v12) |
| Agent crashes on handoff | `VoicePayState` not on `session.userdata` | Check `agent.py` session setup |

---

*Guide generated: 2026-08-14 | Covers: Day 9 Multi-Agent Architecture*
