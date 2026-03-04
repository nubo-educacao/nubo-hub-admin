-- Add education_year to user_profiles and update the update_own_profile RPC

-- 1. Add column to user_profiles
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS education_year TEXT;

-- 2. Update the update_own_profile function to handle the new parameter
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
    p_passport_phase TEXT DEFAULT NULL,
    p_relationship TEXT DEFAULT NULL,
    p_isdependent BOOLEAN DEFAULT NULL,
    p_parent_user_id UUID DEFAULT NULL,
    p_current_dependent_id UUID DEFAULT NULL,
    p_target_user_id UUID DEFAULT NULL,
    p_education_year TEXT DEFAULT NULL -- NEW PARAMETER
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
  v_new_isdependent BOOLEAN;
  v_new_parent_user_id UUID;
  v_new_current_dependent_id UUID;
  v_new_relationship TEXT;
  v_new_education_year TEXT; -- NEW VARIABLE
  v_is_complete BOOLEAN;
  v_updated_profile JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Determine target user to update
  IF p_target_user_id IS NOT NULL THEN
    v_user_id := p_target_user_id;
    -- Authorization check: you can only update yourself or your dependent
    IF v_user_id != auth.uid() THEN
      IF (SELECT parent_user_id FROM public.user_profiles WHERE id = v_user_id) != auth.uid() THEN
        RAISE EXCEPTION 'Not authorized to update this profile';
      END IF;
    END IF;
  ELSE
    v_user_id := auth.uid();
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
  v_new_isdependent := COALESCE(p_isdependent, v_current_profile.isdependent);
  v_new_parent_user_id := COALESCE(p_parent_user_id, v_current_profile.parent_user_id);
  v_new_current_dependent_id := COALESCE(p_current_dependent_id, v_current_profile.current_dependent_id);
  v_new_relationship := COALESCE(p_relationship, v_current_profile.relationship);
  v_new_education_year := COALESCE(p_education_year, v_current_profile.education_year); -- NEW COALESCE

  v_is_complete := (
    v_new_full_name IS NOT NULL AND length(v_new_full_name) > 0
    AND v_new_age IS NOT NULL
    AND v_new_city IS NOT NULL AND length(v_new_city) > 0
    AND v_new_education IS NOT NULL AND length(v_new_education) > 0
    AND v_new_zip_code IS NOT NULL AND length(v_new_zip_code) > 0
    AND (
      (v_new_education NOT IN ('Ensino fundamental', 'Ensino médio incompleto'))
      OR (v_new_education_year IS NOT NULL AND length(v_new_education_year) > 0)
    )
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
    isdependent = v_new_isdependent,
    parent_user_id = v_new_parent_user_id,
    current_dependent_id = v_new_current_dependent_id,
    relationship = v_new_relationship,
    education_year = v_new_education_year, -- NEW COLUMN
    onboarding_completed = CASE WHEN v_is_complete THEN TRUE ELSE onboarding_completed END,
    updated_at = NOW()
  WHERE id = v_user_id
  RETURNING to_jsonb(user_profiles.*) INTO v_updated_profile;

  IF NOT FOUND THEN
    INSERT INTO public.user_profiles (
      id, full_name, age, city, education, education_year,
      zip_code, state, street, street_number, complement,
      passport_phase, isdependent, parent_user_id, current_dependent_id, relationship, onboarding_completed
    )
    VALUES (
      v_user_id, p_full_name, p_age, p_city, p_education, p_education_year,
      p_zip_code, p_state, p_street, p_street_number, p_complement,
      v_new_passport_phase, p_isdependent, p_parent_user_id, p_current_dependent_id, p_relationship, v_is_complete
    )
    RETURNING to_jsonb(user_profiles.*) INTO v_updated_profile;
  END IF;

  RETURN v_updated_profile;
END;
$$;
