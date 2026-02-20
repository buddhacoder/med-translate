-- MedTranslate: Row Level Security Policies

-- Sessions: users can only see their own sessions
CREATE POLICY "Users can view own sessions"
    ON translation_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
    ON translation_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
    ON translation_sessions FOR UPDATE
    USING (auth.uid() = user_id);

-- Audit trail: users can view their own audit events
CREATE POLICY "Users can view own audit events"
    ON hipaa_audit_trail FOR SELECT
    USING (auth.uid() = user_id);

-- Server (service role) can insert audit events for any user
-- This is handled by using the service_role key on the server side,
-- which bypasses RLS. No explicit policy needed for server inserts.

-- Admin role: can view all audit events (for compliance review)
-- Create this role manually and assign to compliance officers
CREATE POLICY "Admins can view all audit events"
    ON hipaa_audit_trail FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

CREATE POLICY "Admins can view all sessions"
    ON translation_sessions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );
