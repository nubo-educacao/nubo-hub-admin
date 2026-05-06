-- Update get_partner_redirect_users to include partner_id and partner_name for filtering
DROP FUNCTION IF EXISTS public.get_partner_redirect_users(uuid);

CREATE OR REPLACE FUNCTION get_partner_redirect_users(p_partner_id UUID DEFAULT NULL)
RETURNS TABLE (
    user_id UUID,
    full_name TEXT,
    whatsapp TEXT,
    redirect_url TEXT,
    created_at TIMESTAMPTZ,
    city TEXT,
    state TEXT,
    education TEXT,
    age INTEGER,
    neighborhood TEXT,
    street TEXT,
    street_number TEXT,
    complement TEXT,
    education_year TEXT,
    zip_code TEXT,
    country TEXT,
    course_interest TEXT[],
    preferred_shifts TEXT[],
    university_preference TEXT,
    program_preference TEXT,
    per_capita_income NUMERIC,
    quota_types TEXT[],
    partner_id UUID,
    partner_name TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT
        up.id AS user_id,
        up.full_name::text,
        au.phone::text AS whatsapp,
        erc.redirect_url,
        erc.created_at,
        up.city,
        up.state,
        up.education,
        up.age,
        up.neighborhood,
        up.street,
        up.street_number,
        up.complement,
        up.education_year,
        up.zip_code,
        up.country,
        upr.course_interest,
        upr.preferred_shifts,
        upr.university_preference,
        upr.program_preference,
        ui.per_capita_income,
        upr.quota_types,
        p.id AS partner_id,
        p.name AS partner_name
    FROM public.external_redirect_clicks erc
    JOIN public.user_profiles up ON up.id = erc.user_id
    JOIN public.partners p ON p.id = erc.partner_id
    LEFT JOIN auth.users au ON au.id = erc.user_id
    LEFT JOIN public.user_preferences upr ON upr.user_id = erc.user_id
    LEFT JOIN public.user_income ui ON ui.user_id = erc.user_id
    WHERE (p_partner_id IS NULL OR erc.partner_id = p_partner_id)
    ORDER BY erc.created_at DESC;
$$;
