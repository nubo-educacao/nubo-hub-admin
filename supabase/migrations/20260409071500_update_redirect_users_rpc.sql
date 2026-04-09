-- Function: get_partner_redirect_users
-- Updated to include more fields from user_profiles for export and profile viewing
DROP FUNCTION IF EXISTS public.get_partner_redirect_users(uuid);

CREATE OR REPLACE FUNCTION get_partner_redirect_users(p_partner_id UUID)
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
    education_year TEXT
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
        up.education_year
    FROM public.external_redirect_clicks erc
    JOIN public.user_profiles up ON up.id = erc.user_id
    LEFT JOIN auth.users au ON au.id = erc.user_id
    WHERE erc.partner_id = p_partner_id
    ORDER BY erc.created_at DESC;
$$;
