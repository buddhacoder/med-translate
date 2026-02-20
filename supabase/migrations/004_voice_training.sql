-- Create training phrases table
CREATE TABLE IF NOT EXISTS public.training_phrases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phrase_text TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create voice contributions table
CREATE TABLE IF NOT EXISTS public.voice_contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phrase_id UUID REFERENCES public.training_phrases(id) ON DELETE CASCADE,
    provider_pin TEXT NOT NULL,
    language_code TEXT NOT NULL,
    audio_url TEXT NOT NULL,
    duration_seconds NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.training_phrases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_contributions ENABLE ROW LEVEL SECURITY;

-- Policies for training_phrases
CREATE POLICY "Anyone can view training phrases" ON public.training_phrases FOR SELECT USING (true);

-- Policies for voice_contributions
CREATE POLICY "Authenticated users can insert voice contributions" ON public.voice_contributions FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view their own contributions" ON public.voice_contributions FOR SELECT USING (true);

-- Insert seed data for the Haitian Creole training module
INSERT INTO public.training_phrases (id, phrase_text, category) VALUES
(gen_random_uuid(), 'I will perform a physical exam now.', 'examination'),
(gen_random_uuid(), 'Your laboratory results are completely normal.', 'results'),
(gen_random_uuid(), 'Please take a deep breath and hold it.', 'instructions'),
(gen_random_uuid(), 'Are you currently experiencing any pain?', 'assessment'),
(gen_random_uuid(), 'We need to schedule a follow-up appointment in two weeks.', 'scheduling'),
(gen_random_uuid(), 'Do you have any known allergies to medications?', 'history'),
(gen_random_uuid(), 'I am prescribing you an antibiotic for the infection.', 'medication'),
(gen_random_uuid(), 'The procedure will take approximately thirty minutes.', 'procedure')
ON CONFLICT DO NOTHING;

-- Create the storage bucket for voice training audio
INSERT INTO storage.buckets (id, name, public) 
VALUES ('voice-training-bucket', 'voice-training-bucket', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for the bucket
CREATE POLICY "Authenticated users can upload audio" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'voice-training-bucket');
CREATE POLICY "Anyone can view training audio" ON storage.objects FOR SELECT USING (bucket_id = 'voice-training-bucket');
