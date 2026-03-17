-- Migration: add_income_and_address_details

-- 1. Add new columns to user_profiles
ALTER TABLE IF EXISTS public.user_profiles 
  ADD COLUMN IF NOT EXISTS neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS outside_brazil BOOLEAN DEFAULT FALSE;

-- 2. Create the user_income table
CREATE TABLE IF NOT EXISTS public.user_income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_count INTEGER,
  social_benefits NUMERIC(10, 2),
  alimony NUMERIC(10, 2),
  member_incomes JSONB DEFAULT '[]'::jsonb,
  per_capita_income NUMERIC(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT user_income_user_id_unique UNIQUE (user_id)
);

-- 3. RLS for user_income
ALTER TABLE public.user_income ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_income' AND policyname = 'Users can view their own income'
  ) THEN
    CREATE POLICY "Users can view their own income" 
      ON public.user_income 
      FOR SELECT 
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_income' AND policyname = 'Users can insert their own income'
  ) THEN
    CREATE POLICY "Users can insert their own income" 
      ON public.user_income 
      FOR INSERT 
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_income' AND policyname = 'Users can update their own income'
  ) THEN
    CREATE POLICY "Users can update their own income" 
      ON public.user_income 
      FOR UPDATE 
      USING (auth.uid() = user_id) 
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_income' AND policyname = 'Service role has full access to user_income'
  ) THEN
    CREATE POLICY "Service role has full access to user_income"
      ON public.user_income
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- 4. Drop the old overloaded function to prevent ambiguity
DROP FUNCTION IF EXISTS public.update_own_profile(
    text, integer, text, text, text, text, text, text, text, text, text, boolean, uuid, uuid, uuid, text, date
);

-- 5. Update the update_own_profile RPC
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
    p_education_year TEXT DEFAULT NULL,
    p_birth_date DATE DEFAULT NULL,
    p_neighborhood TEXT DEFAULT NULL,
    p_country TEXT DEFAULT NULL,
    p_outside_brazil BOOLEAN DEFAULT NULL
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
  v_new_education_year TEXT;
  v_new_birth_date DATE;
  v_new_neighborhood TEXT;
  v_new_country TEXT;
  v_new_outside_brazil BOOLEAN;
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
  v_new_education_year := COALESCE(p_education_year, v_current_profile.education_year);
  v_new_birth_date := COALESCE(p_birth_date, v_current_profile.birth_date);
  v_new_neighborhood := COALESCE(p_neighborhood, v_current_profile.neighborhood);
  v_new_country := COALESCE(p_country, v_current_profile.country);
  v_new_outside_brazil := COALESCE(p_outside_brazil, v_current_profile.outside_brazil);

  v_is_complete := (
    v_new_full_name IS NOT NULL AND length(v_new_full_name) > 0
    AND (v_new_age IS NOT NULL OR v_new_birth_date IS NOT NULL)
    AND v_new_city IS NOT NULL AND length(v_new_city) > 0
    AND v_new_education IS NOT NULL AND length(v_new_education) > 0
    AND (
      (v_new_outside_brazil = TRUE AND v_new_country IS NOT NULL AND length(v_new_country) > 0)
      OR
      (COALESCE(v_new_outside_brazil, FALSE) = FALSE AND v_new_zip_code IS NOT NULL AND length(v_new_zip_code) > 0)
    )
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
    education_year = v_new_education_year,
    birth_date = v_new_birth_date,
    neighborhood = v_new_neighborhood,
    country = v_new_country,
    outside_brazil = v_new_outside_brazil,
    onboarding_completed = CASE WHEN v_is_complete THEN TRUE ELSE onboarding_completed END,
    updated_at = NOW()
  WHERE id = v_user_id
  RETURNING to_jsonb(user_profiles.*) INTO v_updated_profile;

  IF NOT FOUND THEN
    INSERT INTO public.user_profiles (
      id, full_name, age, city, education, education_year,
      zip_code, state, street, street_number, complement,
      passport_phase, isdependent, parent_user_id, current_dependent_id, relationship, onboarding_completed,
      birth_date, neighborhood, country, outside_brazil
    )
    VALUES (
      v_user_id, p_full_name, p_age, p_city, p_education, p_education_year,
      p_zip_code, p_state, p_street, p_street_number, p_complement,
      v_new_passport_phase, p_isdependent, p_parent_user_id, p_current_dependent_id, p_relationship, v_is_complete,
      p_birth_date, p_neighborhood, p_country, p_outside_brazil
    )
    RETURNING to_jsonb(user_profiles.*) INTO v_updated_profile;
  END IF;

  RETURN v_updated_profile;
END;
$$;
