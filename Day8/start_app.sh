#!/bin/bash
# =============================================================================
# VoicePay — Day 7: Start All Services
# =============================================================================
# Usage: ./start_app.sh
#
# Starts:
#   1. Postgres (Docker) — port 5433
#   2. Voice Agent (LiveKit) — connects to LiveKit Cloud
#   3. Escalation API (FastAPI) — port 8081
#   4. Frontend (Next.js) — port 3000
# =============================================================================

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  VoicePay Day 7 — Know When to Ask for Human Help          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Start Postgres
echo -e "${YELLOW}[1/4]${NC} Starting PostgreSQL..."
cd backend
docker compose up -d
echo -e "${GREEN}✓${NC} Postgres running on port 5433"

# Wait for Postgres to be ready
echo "  Waiting for Postgres health check..."
until docker compose exec -T postgres pg_isready -U voicepay -d voicepay > /dev/null 2>&1; do
  sleep 1
done
echo -e "${GREEN}✓${NC} Postgres is healthy"

# Run Day 7 migration (safe to re-run)
echo "  Applying Day 7 schema..."
docker compose exec -T postgres psql -U voicepay -d voicepay -f /docker-entrypoint-initdb.d/02-init-day7.sql 2>/dev/null || true
echo -e "${GREEN}✓${NC} Day 7 schema applied"
echo ""

# 2. Start Voice Agent
echo -e "${YELLOW}[2/4]${NC} Starting Voice Agent..."
cd src
~/.local/bin/uv run python agent.py dev &
AGENT_PID=$!
cd ..
echo -e "${GREEN}✓${NC} Voice Agent started (PID: $AGENT_PID)"
echo ""

# 3. Start Escalation API
echo -e "${YELLOW}[3/4]${NC} Starting Escalation API..."
cd src
~/.local/bin/uv run uvicorn escalation_api:app --host 0.0.0.0 --port 8081 --reload &
API_PID=$!
cd ..
echo -e "${GREEN}✓${NC} Escalation API on http://localhost:8081 (PID: $API_PID)"
echo ""

# 4. Start Frontend
echo -e "${YELLOW}[4/4]${NC} Starting Frontend..."
cd ../frontend
pnpm dev &
FRONTEND_PID=$!
echo -e "${GREEN}✓${NC} Frontend on http://localhost:3000 (PID: $FRONTEND_PID)"
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "  All services running!"
echo "  Voice Agent: http://localhost:3000"
echo "  Dashboard:   http://localhost:3000/dashboard"
echo "  API:         http://localhost:8081/api/escalations"
echo ""
echo "  Press Ctrl+C to stop all services"
echo "═══════════════════════════════════════════════════════════════"

# Wait for Ctrl+C
trap "kill $AGENT_PID $API_PID $FRONTEND_PID 2>/dev/null; docker compose -f backend/docker-compose.yml down; exit 0" SIGINT SIGTERM
wait
