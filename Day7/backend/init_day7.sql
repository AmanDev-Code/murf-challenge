-- =============================================================================
-- VoicePay Escalation & Conversation Logging Schema — Day 7
-- "Know When to Ask for Human Help"
-- Postgres 16 | asyncpg
-- Runs AFTER 01-init.sql (depends on users table + update_updated_at() + uuid-ossp)
-- =============================================================================

-- Human-friendly reference IDs: VP-2026-10001, VP-2026-10002, ...
CREATE SEQUENCE IF NOT EXISTS escalation_seq START 10001;

-- =============================================================================
-- ESCALATIONS — the human-help ticket table
-- One row per issue that needs a human. PII is scrubbed before it lands here.
-- =============================================================================
CREATE TABLE IF NOT EXISTS escalations (
    id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    reference_id     TEXT NOT NULL UNIQUE,                -- VP-2026-XXXXX (given to caller)
    user_id          TEXT REFERENCES users(user_id),      -- who needs help (nullable for anon)
    room_name        TEXT NOT NULL,                       -- LiveKit room the escalation came from

    -- Classification
    type             TEXT NOT NULL CHECK (type IN ('fraud', 'regulatory')),
    urgency          TEXT NOT NULL DEFAULT 'medium'
                        CHECK (urgency IN ('critical', 'high', 'medium', 'low')),

    -- Status lifecycle
    status           TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'in_progress', 'awaiting_callback', 'resolved', 'closed')),
    assigned_to      TEXT,                                -- admin/team name

    -- Content (all PII-scrubbed)
    caller_name      TEXT,                                -- who needs help (display)
    summary          TEXT NOT NULL,                       -- short "for the human" summary
    what_checked     TEXT,                                -- what the agent already tried/checked
    trigger_phrases  TEXT[] DEFAULT '{}',                 -- what tripped the detector
    language         TEXT DEFAULT 'en',                   -- caller's language
    follow_up_method TEXT DEFAULT 'callback',             -- how the caller wants follow-up
    user_consent     BOOLEAN NOT NULL DEFAULT TRUE,       -- caller agreed to share

    -- Resolution + callback
    resolution_notes TEXT,
    resolved_at      TIMESTAMPTZ,
    callback_status  TEXT CHECK (callback_status IN ('pending', 'dispatched', 'completed', 'failed')),
    callback_room    TEXT,

    metadata         JSONB DEFAULT '{}',
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escalations_status   ON escalations(status);
CREATE INDEX IF NOT EXISTS idx_escalations_user     ON escalations(user_id);
CREATE INDEX IF NOT EXISTS idx_escalations_type     ON escalations(type);
CREATE INDEX IF NOT EXISTS idx_escalations_urgency  ON escalations(urgency, status);
CREATE INDEX IF NOT EXISTS idx_escalations_ref      ON escalations(reference_id);
CREATE INDEX IF NOT EXISTS idx_escalations_created  ON escalations(created_at DESC);

-- =============================================================================
-- CONVERSATION_LOGS — real-time log of EVERY conversation (not only escalations)
-- Full audit trail: user speech, agent replies, tool calls + results, system events
-- =============================================================================
CREATE TABLE IF NOT EXISTS conversation_logs (
    id          BIGSERIAL PRIMARY KEY,
    room_name   TEXT NOT NULL,
    user_id     TEXT,
    persona     TEXT,                                     -- which voice was active

    role        TEXT NOT NULL
                    CHECK (role IN ('user', 'agent', 'tool_call', 'tool_result', 'system')),
    content     TEXT NOT NULL,

    tool_name   TEXT,                                     -- for tool_call / tool_result
    tool_args   JSONB,
    sentiment   TEXT,                                     -- positive / negative / neutral / distressed
    language    TEXT DEFAULT 'en',

    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_logs_room ON conversation_logs(room_name, created_at);
CREATE INDEX IF NOT EXISTS idx_conv_logs_user ON conversation_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_logs_role ON conversation_logs(room_name, role);

-- =============================================================================
-- ESCALATION_MESSAGES — transcript snapshot attached to a ticket at creation
-- Copied from conversation_logs so the ticket keeps its evidence even if logs age out
-- =============================================================================
CREATE TABLE IF NOT EXISTS escalation_messages (
    id                 BIGSERIAL PRIMARY KEY,
    escalation_id      UUID NOT NULL REFERENCES escalations(id) ON DELETE CASCADE,

    role               TEXT NOT NULL
                          CHECK (role IN ('user', 'agent', 'tool_call', 'tool_result', 'system')),
    content            TEXT NOT NULL,
    tool_name          TEXT,
    tool_args          JSONB,

    original_timestamp TIMESTAMPTZ NOT NULL,              -- when it was originally said
    created_at         TIMESTAMPTZ DEFAULT NOW()          -- when copied to the ticket
);

CREATE INDEX IF NOT EXISTS idx_esc_msgs_escalation
    ON escalation_messages(escalation_id, original_timestamp);

-- =============================================================================
-- ESCALATION_AUDIT_LOG — every status change, assignment, note, callback
-- =============================================================================
CREATE TABLE IF NOT EXISTS escalation_audit_log (
    id            BIGSERIAL PRIMARY KEY,
    escalation_id UUID NOT NULL REFERENCES escalations(id) ON DELETE CASCADE,

    action        TEXT NOT NULL,                          -- status_change / assigned / note_added / callback_triggered / created
    actor         TEXT NOT NULL DEFAULT 'system',
    old_value     TEXT,
    new_value     TEXT,
    notes         TEXT,

    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_escalation
    ON escalation_audit_log(escalation_id, created_at);

-- =============================================================================
-- Auto-update escalations.updated_at (reuses update_updated_at() from 01-init.sql)
-- =============================================================================
DROP TRIGGER IF EXISTS trg_escalations_updated_at ON escalations;
CREATE TRIGGER trg_escalations_updated_at
    BEFORE UPDATE ON escalations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
