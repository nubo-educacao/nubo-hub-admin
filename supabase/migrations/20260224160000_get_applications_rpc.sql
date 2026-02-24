-- ============================================================================
-- Migration: RPC to fetch student applications with user details
-- Joins student_applications + user_profiles + auth.users + partners
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_student_applications_with_details(
    p_partner_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    partner_id UUID,
    partner_name TEXT,
    full_name TEXT,
    phone TEXT,
    status TEXT,
    answers JSONB,
    created_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        sa.id,
        sa.user_id,
        sa.partner_id,
        p.name AS partner_name,
        up.full_name,
        u.phone,
        sa.status,
        sa.answers,
        sa.created_at
    FROM
        public.student_applications sa
    LEFT JOIN
        public.user_profiles up ON sa.user_id = up.id
    LEFT JOIN
        auth.users u ON sa.user_id = u.id
    LEFT JOIN
        public.partners p ON sa.partner_id = p.id
    WHERE
        (p_partner_id IS NULL OR sa.partner_id = p_partner_id)
    ORDER BY
        sa.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.get_student_applications_with_details IS
    'Fetches student applications with enriched user profile, phone, and partner name. Pass p_partner_id to filter by partner, or NULL for all.';
