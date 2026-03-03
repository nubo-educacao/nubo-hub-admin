-- 1. Drop old function signatures to prevent overloading issues
DROP FUNCTION IF EXISTS public.update_own_profile(p_full_name text, p_age integer, p_city text, p_education text);
DROP FUNCTION IF EXISTS public.update_own_profile(p_full_name text, p_age integer, p_city text, p_education text, p_zip_code text, p_state text, p_street text, p_street_number text, p_complement text);

-- 2. Create the new function signature with p_passport_phase
CREATE OR REPLACE FUNCTION public.update_own_profile(
    p_full_name TEXT DEFAULT NULL,
    p_age INTEGER DEFAULT NULL,
    p_city TEXT DEFAULT NULL,
    p_education TEXT DEFAULT NULL,
    p_zip_code TEXT DEFAULT NULL,
    p_state TEXT DEFAULT NULL,
    p_street TEXT DEFAULT NULL,
    p_street_number TEXT DEFAULT NULL,
    p_complement TEXT DEFAULT NULL,
    p_passport_phase TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_current_profile RECORD;
  v_new_full_name TEXT;
  v_new_age INTEGER;
  v_new_city TEXT;
  v_new_education TEXT;
  v_new_zip_code TEXT;
  v_new_state TEXT;
  v_new_street TEXT;
  v_new_street_number TEXT;
  v_new_complement TEXT;
  v_new_passport_phase TEXT;
  v_is_complete BOOLEAN;
  v_updated_profile JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_current_profile FROM public.user_profiles WHERE id = v_user_id;

  v_new_full_name := COALESCE(p_full_name, v_current_profile.full_name);
  v_new_age := COALESCE(p_age, v_current_profile.age);
  v_new_city := COALESCE(p_city, v_current_profile.city);
  v_new_education := COALESCE(p_education, v_current_profile.education);
  v_new_zip_code := COALESCE(p_zip_code, v_current_profile.zip_code);
  v_new_state := COALESCE(p_state, v_current_profile.state);
  v_new_street := COALESCE(p_street, v_current_profile.street);
  v_new_street_number := COALESCE(p_street_number, v_current_profile.street_number);
  v_new_complement := COALESCE(p_complement, v_current_profile.complement);
  v_new_passport_phase := COALESCE(p_passport_phase, v_current_profile.passport_phase);

  v_is_complete := (
    v_new_full_name IS NOT NULL AND length(v_new_full_name) > 0
    AND v_new_age IS NOT NULL
    AND v_new_city IS NOT NULL AND length(v_new_city) > 0
    AND v_new_education IS NOT NULL AND length(v_new_education) > 0
    AND v_new_zip_code IS NOT NULL AND length(v_new_zip_code) > 0
  );

  UPDATE public.user_profiles SET
    full_name = v_new_full_name,
    age = v_new_age,
    city = v_new_city,
    education = v_new_education,
    zip_code = v_new_zip_code,
    state = v_new_state,
    street = v_new_street,
    street_number = v_new_street_number,
    complement = v_new_complement,
    passport_phase = v_new_passport_phase,
    onboarding_completed = CASE WHEN v_is_complete THEN TRUE ELSE onboarding_completed END,
    updated_at = NOW()
  WHERE id = v_user_id
  RETURNING to_jsonb(user_profiles.*) INTO v_updated_profile;

  IF NOT FOUND THEN
    INSERT INTO public.user_profiles (
      id, full_name, age, city, education,
      zip_code, state, street, street_number, complement,
      passport_phase, onboarding_completed
    )
    VALUES (
      v_user_id, p_full_name, p_age, p_city, p_education,
      p_zip_code, p_state, p_street, p_street_number, p_complement,
      v_new_passport_phase, v_is_complete
    )
    RETURNING to_jsonb(user_profiles.*) INTO v_updated_profile;
  END IF;

  RETURN v_updated_profile;
END;
$$;
