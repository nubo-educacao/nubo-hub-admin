-- Add passport_phase to user_profiles to persist workflow state across requests
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS passport_phase TEXT DEFAULT 'INTRO';
