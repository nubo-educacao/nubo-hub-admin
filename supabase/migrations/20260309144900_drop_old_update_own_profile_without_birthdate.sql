-- Drop the old overloaded version of update_own_profile that lacks p_birth_date.
-- Having both versions causes PostgREST PGRST203 (Ambiguous Function Call).

DROP FUNCTION IF EXISTS public.update_own_profile(
  p_full_name text,
  p_age integer,
  p_city text,
  p_education text,
  p_zip_code text,
  p_state text,
  p_street text,
  p_street_number text,
  p_complement text,
  p_passport_phase text,
  p_relationship text,
  p_isdependent boolean,
  p_parent_user_id uuid,
  p_current_dependent_id uuid,
  p_target_user_id uuid,
  p_education_year text
);
