-- =============================================================================
-- VoicePay Memory Schema — Day 4
-- Postgres 16 | asyncpg
-- =============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- USERS TABLE — core identity + preferences
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    user_id       TEXT PRIMARY KEY,                    -- LiveKit participant identity or phone
    name          TEXT,                                 -- User's self-reported name
    language_pref TEXT DEFAULT 'en',                    -- 'en', 'hi', 'hinglish'
    persona_pref  TEXT DEFAULT 'anisha',                -- preferred voice persona
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    last_interaction TIMESTAMPTZ DEFAULT NOW(),
    total_calls   INTEGER DEFAULT 1,
    consent_given BOOLEAN DEFAULT FALSE                 -- explicit consent to store data
);

-- Fast lookup by user_id (primary key covers it)
-- Index on last_interaction for cleanup/analytics
CREATE INDEX IF NOT EXISTS idx_users_last_interaction ON users(last_interaction DESC);

-- =============================================================================
-- USER FACTS — key-value pairs of things the agent learns
-- Financial Services track: schemes checked, eligibility, goals
-- NEVER stores: account numbers, Aadhaar, PAN, OTP, PIN, passwords
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_facts (
    id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    fact_key      TEXT NOT NULL,                        -- e.g. 'schemes_checked', 'investment_goal'
    fact_value    TEXT NOT NULL,                        -- the actual fact
    source        TEXT DEFAULT 'conversation',          -- how we learned it
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Fast lookup: all facts for a user
CREATE INDEX IF NOT EXISTS idx_user_facts_user_id ON user_facts(user_id);
-- Unique constraint: one value per key per user (upsert-friendly)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_facts_unique ON user_facts(user_id, fact_key);

-- =============================================================================
-- CONVERSATION SUMMARIES — brief per-call summaries for context
-- =============================================================================
CREATE TABLE IF NOT EXISTS conversation_summaries (
    id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    room_name     TEXT NOT NULL,                        -- LiveKit room name
    summary       TEXT NOT NULL,                        -- 1-2 sentence summary of the call
    topics        TEXT[] DEFAULT '{}',                  -- topics discussed
    tools_used    TEXT[] DEFAULT '{}',                  -- tools called during the session
    duration_s    INTEGER DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_summaries_user ON conversation_summaries(user_id, created_at DESC);

-- =============================================================================
-- HELPER: auto-update updated_at on row change
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_user_facts_updated_at
    BEFORE UPDATE ON user_facts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
