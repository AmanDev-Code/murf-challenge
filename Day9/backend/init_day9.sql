-- =============================================================================
-- VoicePay Multi-Agent Schema — Day 9
-- "6-Specialist Handoff Architecture"
-- Postgres 17 | asyncpg
-- Runs AFTER init_day8.sql
-- =============================================================================

-- =============================================================================
-- AGENT_HANDOFFS — one row per handoff event (real-time insert)
-- =============================================================================
CREATE TABLE IF NOT EXISTS agent_handoffs (
    id              BIGSERIAL PRIMARY KEY,
    session_id      UUID,
    room_name       TEXT NOT NULL,
    user_id         TEXT,

    from_agent      TEXT NOT NULL,
    to_agent        TEXT NOT NULL,
    reason          TEXT NOT NULL,
    context_summary TEXT,

    handoff_index   INTEGER NOT NULL DEFAULT 0,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_handoffs_room ON agent_handoffs(room_name, timestamp);
CREATE INDEX IF NOT EXISTS idx_handoffs_session ON agent_handoffs(session_id);
CREATE INDEX IF NOT EXISTS idx_handoffs_agents ON agent_handoffs(from_agent, to_agent);
CREATE INDEX IF NOT EXISTS idx_handoffs_time ON agent_handoffs(timestamp DESC);

-- =============================================================================
-- ENHANCE call_analytics — add multi-agent columns
-- =============================================================================
ALTER TABLE call_analytics
    ADD COLUMN IF NOT EXISTS handoff_count    INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS agents_used      TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS primary_agent    TEXT DEFAULT 'triage',
    ADD COLUMN IF NOT EXISTS handoff_timeline JSONB DEFAULT '[]';

-- Index for agent utilization queries
CREATE INDEX IF NOT EXISTS idx_call_analytics_agents
    ON call_analytics USING GIN(agents_used);

-- =============================================================================
-- AGENT_METRICS — per-agent per-day aggregation (upserted at session end)
-- =============================================================================
CREATE TABLE IF NOT EXISTS agent_metrics (
    id                BIGSERIAL PRIMARY KEY,
    date              DATE NOT NULL DEFAULT CURRENT_DATE,
    agent_name        TEXT NOT NULL,

    total_activations INTEGER DEFAULT 0,
    avg_duration_ms   FLOAT DEFAULT 0,
    tool_calls        INTEGER DEFAULT 0,
    tool_errors       INTEGER DEFAULT 0,
    handoffs_in       INTEGER DEFAULT 0,
    handoffs_out      INTEGER DEFAULT 0,

    UNIQUE(date, agent_name)
);

CREATE INDEX IF NOT EXISTS idx_agent_metrics_date ON agent_metrics(date DESC);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_name ON agent_metrics(agent_name, date DESC);
