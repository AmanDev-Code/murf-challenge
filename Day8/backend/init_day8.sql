-- =============================================================================
-- VoicePay Call Analytics Schema — Day 8
-- "Build a Call Analytics Dashboard"
-- Postgres 16 | asyncpg
-- Runs AFTER 02-init-day7.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS call_analytics (
    session_id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    room_name           TEXT NOT NULL UNIQUE,
    user_id             TEXT,
    persona             TEXT DEFAULT 'anisha',
    channel             TEXT DEFAULT 'browser'
                            CHECK (channel IN ('browser', 'sip')),

    -- Timing
    started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at            TIMESTAMPTZ,
    duration_s          INTEGER DEFAULT 0,

    -- Turn counts
    user_turns          INTEGER DEFAULT 0,
    agent_turns         INTEGER DEFAULT 0,

    -- Tool usage
    tool_calls          JSONB DEFAULT '{}',
    tools_used          TEXT[] DEFAULT '{}',
    tool_errors         INTEGER DEFAULT 0,

    -- Safety & escalations
    security_blocks     INTEGER DEFAULT 0,
    escalations         INTEGER DEFAULT 0,

    -- Language
    language            TEXT DEFAULT 'en',

    -- Outcome classification
    outcome             TEXT DEFAULT 'unknown'
                            CHECK (outcome IN ('success', 'failed', 'abandoned', 'error', 'unknown')),
    outcome_reason      TEXT,
    success_criteria_met TEXT[] DEFAULT '{}',

    -- Latency metrics
    avg_latency_ms      FLOAT DEFAULT 0,
    p95_latency_ms      FLOAT DEFAULT 0,
    latency_breakdown   JSONB DEFAULT '{}',

    -- Extra context
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_call_analytics_started
    ON call_analytics(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_analytics_outcome
    ON call_analytics(outcome);
CREATE INDEX IF NOT EXISTS idx_call_analytics_language
    ON call_analytics(language);
CREATE INDEX IF NOT EXISTS idx_call_analytics_channel
    ON call_analytics(channel);
CREATE INDEX IF NOT EXISTS idx_call_analytics_persona
    ON call_analytics(persona);
CREATE INDEX IF NOT EXISTS idx_call_analytics_user
    ON call_analytics(user_id);

-- Composite index for timeline queries (calls over time by outcome)
CREATE INDEX IF NOT EXISTS idx_call_analytics_time_outcome
    ON call_analytics(started_at, outcome);
