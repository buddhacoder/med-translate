-- MedTranslate: Translation Sessions Table
-- Stores ONLY session metadata — NO audio, NO transcripts, NO PHI

CREATE TABLE IF NOT EXISTS translation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    language_pair TEXT NOT NULL DEFAULT 'en-es',
    duration_seconds INTEGER,
    status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'ended', 'timed_out', 'error')),
    CHECK (language_pair IN ('en-es', 'es-en', 'en-ht', 'ht-en'))
);

-- Index for user session lookups
CREATE INDEX idx_sessions_user_id ON translation_sessions(user_id);
CREATE INDEX idx_sessions_status ON translation_sessions(status);

ALTER TABLE translation_sessions ENABLE ROW LEVEL SECURITY;
