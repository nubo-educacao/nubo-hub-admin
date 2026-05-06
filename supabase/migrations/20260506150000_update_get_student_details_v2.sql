-- Update get_student_details_v2 to match the expected frontend structure (with profile wrapper) and include all fields
DROP FUNCTION IF EXISTS public.get_student_details_v2(uuid);

CREATE OR REPLACE FUNCTION public.get_student_details_v2(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result jsonb;
    v_partner_id uuid;
    v_is_admin boolean := false;
    v_has_access boolean := false;
BEGIN
    -- 1. Check if user is admin or belongs to a partner
    SELECT EXISTS (
        SELECT 1 FROM public.user_permissions 
        WHERE user_id = auth.uid() 
        AND permission IN ('Estudantes', 'Dashboard', 'Parceiros')
    ) OR (auth.jwt() ->> 'role' = 'service_role') INTO v_is_admin;
    
    -- Get partner_id if the user is a partner
    SELECT partner_id INTO v_partner_id FROM public.partners_users WHERE user_id = auth.uid() LIMIT 1;

    -- 2. Verify access
    IF v_is_admin THEN
        v_has_access := TRUE;
    ELSE
        -- Access if user is a partner and the student has an application with this partner OR a redirect click
        IF v_partner_id IS NOT NULL THEN
            SELECT EXISTS (
                SELECT 1 FROM public.student_applications WHERE user_id = p_student_id AND partner_id = v_partner_id
                UNION
                SELECT 1 FROM public.external_redirect_clicks WHERE user_id = p_student_id AND partner_id = v_partner_id
            ) INTO v_has_access;
        END IF;
    END IF;

    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Access denied to student details';
    END IF;

    -- 3. Fetch data matching the frontend's expected schema
    SELECT jsonb_build_object(
        'profile', (
            SELECT jsonb_build_object(
                'id', up.id,
                'full_name', up.full_name,
                'email', au.email,
                'phone', au.phone,
                'city', up.city,
                'state', up.state,
                'neighborhood', up.neighborhood,
                'street', up.street,
                'street_number', up.street_number,
                'complement', up.complement,
                'zip_code', up.zip_code,
                'country', up.country,
                'education', up.education,
                'education_year', up.education_year,
                'age', up.age,
                'created_at', up.created_at,
                'is_nubo_student', up.is_nubo_student
            ) FROM public.user_profiles up
            JOIN auth.users au ON au.id = up.id
            WHERE up.id = p_student_id
        ),
        'preferences', (
            SELECT jsonb_build_object(
                'course_interest', course_interest,
                'preferred_shifts', preferred_shifts,
                'university_preference', university_preference,
                'program_preference', program_preference,
                'quota_types', quota_types
            ) FROM public.user_preferences WHERE user_id = p_student_id LIMIT 1
        ),
        'income', (
            SELECT jsonb_build_object(
                'per_capita_income', per_capita_income
            ) FROM public.user_income WHERE user_id = p_student_id LIMIT 1
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
