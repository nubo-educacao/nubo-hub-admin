-- ============================================================================
-- Add columns to user_profiles to support dependents via passport_workflow
-- ============================================================================

-- 1. Remove FK on user_profiles.id -> auth.users if it exists
-- This allows creating dependent profiles without auth.users entries
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_profiles_id_fkey' 
        AND table_name = 'user_profiles'
    ) THEN
        ALTER TABLE public.user_profiles DROP CONSTRAINT user_profiles_id_fkey;
    END IF;
END $$;

-- 2. Add isdependent boolean column
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS isdependent BOOLEAN DEFAULT FALSE;

-- 3. Add parent_user_id to link dependent -> responsible
-- References user_profiles.id (NOT auth.users) since dependents don't have auth accounts
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS parent_user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE;

-- 4. Add current_dependent_id to track which dependent the parent is currently applying for
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS current_dependent_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- 5. Add passport_phase to persist workflow state
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS passport_phase TEXT DEFAULT 'INTRO';
