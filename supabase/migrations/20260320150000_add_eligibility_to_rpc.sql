-- Fix: Add eligibility_results to the RPC return so the UI table can read it.

DROP FUNCTION IF EXISTS public.get_student_applications_with_details(uuid);

CREATE OR REPLACE FUNCTION public.get_student_applications_with_details(p_partner_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, user_id uuid, partner_id uuid, partner_name text, full_name text, phone text, status text, answers jsonb, created_at timestamp with time zone, eligibility_results jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
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
        sa.created_at,
        up.eligibility_results
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
$function$;
