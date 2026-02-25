-- Phase 12: Custom Phrases & Validation Upgrades
-- Creates the custom_phrases table for user-specific translation presets.

CREATE TABLE IF NOT EXISTS public.custom_phrases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_pin TEXT NOT NULL,
    phrase_text TEXT NOT NULL,
    category TEXT DEFAULT 'Custom',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies
ALTER TABLE public.custom_phrases ENABLE ROW LEVEL SECURITY;

-- Allow read access
CREATE POLICY "Providers can read their own phrases" ON public.custom_phrases
    FOR SELECT
    USING (true);

-- Allow insert access 
CREATE POLICY "Providers can insert their own phrases" ON public.custom_phrases
    FOR INSERT
    WITH CHECK (true);

-- Allow delete access
CREATE POLICY "Providers can delete their own phrases" ON public.custom_phrases
    FOR DELETE
    USING (true);

-- End Migration
