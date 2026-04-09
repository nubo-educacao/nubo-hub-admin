-- Function: get_student_details_v2
-- Fetches enriched student details bypassing RLS with security check
DROP FUNCTION IF EXISTS public.get_student_details_v2(uuid);

CREATE OR REPLACE FUNCTION public.get_student_details_v2(p_student_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
DECLARE
    v_partner_id UUID;
    v_has_access BOOLEAN;
    v_result JSONB;
BEGIN
    -- 1. Get current partner ID
    SELECT partner_id INTO v_partner_id FROM public.partners_users WHERE user_id = auth.uid() LIMIT 1;

    -- 2. Verify access
    -- Access if student has an application with this partner OR a redirect click
    SELECT EXISTS (
        SELECT 1 FROM public.student_applications WHERE user_id = p_student_id AND partner_id = v_partner_id
        UNION
        SELECT 1 FROM public.external_redirect_clicks WHERE user_id = p_student_id AND partner_id = v_partner_id
    ) INTO v_has_access;

    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Access denied to student details';
    END IF;

    -- 3. Build Result
    SELECT jsonb_build_object(
        'profile', (
            SELECT jsonb_build_object(
                'id', id,
                'full_name', full_name,
                'age', age,
                'city', city,
                'state', state,
                'education', education,
                'is_nubo_student', is_nubo_student,
                'created_at', created_at
            ) FROM public.user_profiles WHERE id = p_student_id
        ),
        'preferences', (
            SELECT jsonb_build_object(
                'course_interest', course_interest,
                'preferred_shifts', preferred_shifts,
                'university_preference', university_preference,
                'program_preference', program_preference,
                'family_income_per_capita', family_income_per_capita,
                'quota_types', quota_types
            ) FROM public.user_preferences WHERE user_id = p_student_id LIMIT 1
        ),
        'enem_scores', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', id,
                'year', year,
                'nota_linguagens', nota_linguagens,
                'nota_ciencias_humanas', nota_ciencias_humanas,
                'nota_ciencias_natureza', nota_ciencias_natureza,
                'nota_matematica', nota_matematica,
                'nota_redacao', nota_redacao
            )), '[]'::jsonb) FROM public.user_enem_scores WHERE user_id = p_student_id
        ),
        'favorites', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', uf.id,
                'course_id', uf.course_id,
                'partner_id', uf.partner_id,
                'created_at', uf.created_at,
                'courses', (SELECT jsonb_build_object('name', course_name) FROM public.courses WHERE id = uf.course_id),
                'partners', (SELECT jsonb_build_object('name', name) FROM public.partners WHERE id = uf.partner_id)
            )), '[]'::jsonb) FROM public.user_favorites uf WHERE user_id = p_student_id
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;
