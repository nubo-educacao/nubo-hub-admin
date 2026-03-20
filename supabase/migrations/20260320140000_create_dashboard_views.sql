-- View: vw_admin_user_funnel
CREATE OR REPLACE VIEW public.vw_admin_user_funnel AS
WITH user_apps AS (
  SELECT
    user_id,
    COUNT(*) AS total_applications_started,
    COUNT(*) FILTER (WHERE status = 'SUBMITTED') AS total_applications_submitted
  FROM public.student_applications
  GROUP BY user_id
)
SELECT
  up.id AS user_id,
  up.full_name,
  up.created_at,
  up.isdependent,
  up.parent_user_id,
  up.passport_phase,
  up.furthest_passport_phase,
  (up.active_workflow = 'passport_workflow' OR up.furthest_passport_phase IS NOT NULL) AS passport_started,
  COALESCE(ua.total_applications_started, 0) AS total_applications_started,
  COALESCE(ua.total_applications_submitted, 0) AS total_applications_submitted
FROM public.user_profiles up
LEFT JOIN user_apps ua ON ua.user_id = up.id
WHERE up.created_at >= '2026-03-09 00:00:00+00';

-- View: vw_admin_passport_phases
CREATE OR REPLACE VIEW public.vw_admin_passport_phases AS
SELECT
  COALESCE(passport_phase, 'UNSTARTED') AS passport_phase,
  COUNT(*) AS total_users
FROM public.user_profiles
WHERE created_at >= '2026-03-09 00:00:00+00'
GROUP BY passport_phase;

-- View: vw_admin_furthest_passport_phases
CREATE OR REPLACE VIEW public.vw_admin_furthest_passport_phases AS
SELECT
  COALESCE(furthest_passport_phase, 'UNSTARTED') AS furthest_passport_phase,
  COUNT(*) AS total_users
FROM public.user_profiles
WHERE created_at >= '2026-03-09 00:00:00+00'
GROUP BY furthest_passport_phase;

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
)
SELECT
  p.id AS partner_id,
  p.name AS partner_name,
  COALESCE(pc.total_unique_clicks, 0) AS total_unique_clicks,
  COALESCE(pa.total_applications_started, 0) AS total_applications_started,
  COALESCE(pa.total_applications_submitted, 0) AS total_applications_submitted
FROM public.partners p
LEFT JOIN partner_clicks pc ON p.id = pc.partner_id
LEFT JOIN partner_apps pa ON p.id = pa.partner_id;

-- View: vw_partner_application_details
CREATE OR REPLACE VIEW public.vw_partner_application_details AS
SELECT
  sa.id AS application_id,
  sa.partner_id,
  sa.user_id,
  up.full_name AS student_name,
  sa.status,
  sa.created_at,
  sa.updated_at,
  (
    SELECT COUNT(*) 
    FROM jsonb_object_keys(
      CASE 
        WHEN jsonb_typeof(sa.answers) = 'object' THEN sa.answers 
        ELSE '{}'::jsonb 
      END
    )
  ) AS total_answers_filled
FROM public.student_applications sa
JOIN public.user_profiles up ON up.id = sa.user_id;

-- View: vw_admin_funnel_chart (Derived view for Funnel visualization)
CREATE OR REPLACE VIEW public.vw_admin_funnel_chart AS
SELECT
  '1. Total de Usuários' AS step_name,
  1 AS step_order,
  COUNT(*) AS user_count
FROM public.vw_admin_user_funnel
UNION ALL
SELECT
  '2. Passaporte Iniciado' AS step_name,
  2 AS step_order,
  COUNT(*) AS user_count
FROM public.vw_admin_user_funnel
WHERE passport_started = true
UNION ALL
SELECT
  '3. 1ª Candidatura Iniciada' AS step_name,
  3 AS step_order,
  COUNT(*) AS user_count
FROM public.vw_admin_user_funnel
WHERE total_applications_started >= 1
UNION ALL
SELECT
  '4. 1ª Candidatura Concluída' AS step_name,
  4 AS step_order,
  COUNT(*) AS user_count
FROM public.vw_admin_user_funnel
WHERE total_applications_submitted >= 1
UNION ALL
SELECT
  '5. 2ª Candidatura Iniciada' AS step_name,
  5 AS step_order,
  COUNT(*) AS user_count
FROM public.vw_admin_user_funnel
WHERE total_applications_started >= 2
UNION ALL
SELECT
  '6. 2ª Candidatura Concluída' AS step_name,
  6 AS step_order,
  COUNT(*) AS user_count
FROM public.vw_admin_user_funnel
WHERE total_applications_submitted >= 2;

-- Grant permissions to standard roles for PostgREST
GRANT SELECT ON public.vw_admin_user_funnel TO anon, authenticated, service_role;
GRANT SELECT ON public.vw_admin_passport_phases TO anon, authenticated, service_role;
GRANT SELECT ON public.vw_admin_furthest_passport_phases TO anon, authenticated, service_role;
GRANT SELECT ON public.vw_partner_funnel TO anon, authenticated, service_role;
GRANT SELECT ON public.vw_partner_application_details TO anon, authenticated, service_role;
GRANT SELECT ON public.vw_admin_funnel_chart TO anon, authenticated, service_role;

-- View: vw_partner_application_completion_buckets
CREATE OR REPLACE VIEW public.vw_partner_application_completion_buckets AS
WITH partner_form_counts AS (
  SELECT partner_id, COUNT(*) AS total_forms
  FROM public.partner_forms
  GROUP BY partner_id
),
application_percentages AS (
  SELECT
    a.application_id,
    a.partner_id,
    a.status,
    a.total_answers_filled,
    COALESCE(fc.total_forms, 0) AS total_forms,
    CASE 
      WHEN a.status = 'SUBMITTED' THEN 100
      WHEN COALESCE(fc.total_forms, 0) = 0 THEN 0
      ELSE LEAST(100, (a.total_answers_filled * 100) / fc.total_forms)
    END AS completion_percent
  FROM public.vw_partner_application_details a
  LEFT JOIN partner_form_counts fc ON a.partner_id = fc.partner_id
)
SELECT
  partner_id,
  CASE 
    WHEN completion_percent <= 25 THEN '1. Até 25%'
    WHEN completion_percent <= 50 THEN '2. Até 50%'
    WHEN completion_percent <= 75 THEN '3. Até 75%'
    ELSE '4. Até 100%'
  END AS completion_bucket,
  COUNT(*) AS applications_count
FROM application_percentages
GROUP BY partner_id, completion_bucket;

GRANT SELECT ON public.vw_partner_application_completion_buckets TO anon, authenticated, service_role;
