-- MedTranslate: HIPAA Audit Trail
-- Logs access events and session lifecycle — NEVER conversation content

CREATE TABLE IF NOT EXISTS hipaa_audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES translation_sessions(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_hash TEXT,
    device_fingerprint_hash TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Valid event types:
-- 'auth_success', 'auth_failure', 'session_start', 'session_end',
-- 'session_timeout', 'language_switch', 'connection_drop', 'connection_restore'

COMMENT ON TABLE hipaa_audit_trail IS 'HIPAA audit trail. NEVER store audio, transcripts, or PHI in this table.';
COMMENT ON COLUMN hipaa_audit_trail.metadata IS 'Non-PHI metadata only: e.g. language_pair, session_duration, error_code';

CREATE INDEX idx_audit_user_id ON hipaa_audit_trail(user_id);
CREATE INDEX idx_audit_timestamp ON hipaa_audit_trail(timestamp);
CREATE INDEX idx_audit_event_type ON hipaa_audit_trail(event_type);

ALTER TABLE hipaa_audit_trail ENABLE ROW LEVEL SECURITY;
