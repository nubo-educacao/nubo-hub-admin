-- View: vw_partner_funnel
CREATE OR REPLACE VIEW public.vw_partner_funnel AS
WITH partner_clicks AS (
  SELECT
    partner_id,
    COUNT(DISTINCT user_id) AS total_unique_clicks
  FROM public.partners_click
  WHERE created_at >= '2026-03-09 00:00:00+00'
  GROUP BY partner_id
),
partner_apps AS (
  SELECT
    partner_id,
    COUNT(DISTINCT user_id) AS total_applications_started,
    COUNT(DISTINCT CASE WHEN status = 'SUBMITTED' THEN user_id END) AS total_applications_submitted
  FROM public.student_applications
  WHERE created_at >= '2026-03-09 00:00:00+00'
  GROUP BY partner_id
),
external_clicks AS (
  SELECT
    partner_id,
    COUNT(DISTINCT user_id) AS total_external_redirect_clicks
  FROM public.external_redirect_clicks
  WHERE created_at >= '2026-03-09 00:00:00+00'
  GROUP BY partner_id
)
SELECT
  p.id AS partner_id,
  p.name AS partner_name,
  COALESCE(pc.total_unique_clicks, 0) AS total_unique_clicks,
  COALESCE(pa.total_applications_started, 0) AS total_applications_started,
  COALESCE(pa.total_applications_submitted, 0) AS total_applications_submitted,
  COALESCE(ec.total_external_redirect_clicks, 0) AS total_external_redirect_clicks
FROM public.partners p
LEFT JOIN partner_clicks pc ON p.id = pc.partner_id
LEFT JOIN partner_apps pa ON p.id = pa.partner_id
LEFT JOIN external_clicks ec ON p.id = ec.partner_id;

GRANT SELECT ON public.vw_partner_funnel TO anon, authenticated, service_role;

-- Function: get_partner_redirect_users
CREATE OR REPLACE FUNCTION get_partner_redirect_users(p_partner_id UUID)
RETURNS TABLE (
    full_name TEXT,
    whatsapp TEXT,
    redirect_url TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT
        up.full_name::text,
        au.phone::text AS whatsapp,
        erc.redirect_url,
        erc.created_at
    FROM public.external_redirect_clicks erc
    JOIN public.user_profiles up ON up.id = erc.user_id
    LEFT JOIN auth.users au ON au.id = erc.user_id
    WHERE erc.partner_id = p_partner_id
    ORDER BY erc.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_partner_redirect_users(UUID) TO authenticated, service_role;
