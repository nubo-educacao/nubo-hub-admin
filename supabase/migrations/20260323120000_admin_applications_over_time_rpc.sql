CREATE OR REPLACE FUNCTION public.get_admin_applications_over_time(p_partner_id uuid DEFAULT NULL, p_days_ago integer DEFAULT 30)
 RETURNS TABLE(date text, partner_id uuid, partner_name text, count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        to_char(sa.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS date,
        sa.partner_id,
        p.name AS partner_name,
        COUNT(*) AS count
    FROM public.student_applications sa
    LEFT JOIN public.partners p ON p.id = sa.partner_id
    WHERE (p_partner_id IS NULL OR sa.partner_id = p_partner_id)
      AND (p_days_ago IS NULL OR sa.created_at >= (now() - (p_days_ago || ' days')::interval))
    GROUP BY to_char(sa.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD'), sa.partner_id, p.name
    ORDER BY date ASC;
END;
$function$;
