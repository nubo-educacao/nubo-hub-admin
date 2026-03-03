-- ============================================================
-- 20260303060349_auto_create_profile_with_intro.sql
-- Updates get_own_profile to auto-create the user profile with 
-- the INTRO phase if it doesn't already exist.
-- Also sets the default value for passport_phase to 'INTRO'.
-- ============================================================

-- 1. Set default value for passport_phase
ALTER TABLE public.user_profiles 
ALTER COLUMN passport_phase SET DEFAULT 'INTRO';

-- 2. Update get_own_profile to auto-create record
CREATE OR REPLACE FUNCTION public.get_own_profile()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_profile RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_profile FROM public.user_profiles WHERE id = v_user_id;

  IF v_profile IS NULL THEN
    -- Auto-create profile on first access with INTRO phase
    INSERT INTO public.user_profiles (id, passport_phase)
    VALUES (v_user_id, 'INTRO')
    ON CONFLICT (id) DO NOTHING
    RETURNING * INTO v_profile;
    
    -- If conflict happened (e.g. race condition) and RETURNING didn't work, select again
    IF v_profile IS NULL THEN
       SELECT * INTO v_profile FROM public.user_profiles WHERE id = v_user_id;
    END IF;
  END IF;

  -- One final check, theoretically shouldn't hit this unless insert failed without conflict
  IF v_profile IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN to_jsonb(v_profile);
END;
$$;
