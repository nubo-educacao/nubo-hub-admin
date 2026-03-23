CREATE OR REPLACE FUNCTION public.get_admin_funnel_users()
 RETURNS TABLE(whatsapp text, full_name text, funnel_phase text, step_order integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        au.phone::text AS whatsapp,
        v.full_name::text,
        CASE
            WHEN v.total_applications_submitted >= 2 THEN '6. 2ª Candidatura Concluída'
            WHEN v.total_applications_started >= 2 THEN '5. 2ª Candidatura Iniciada'
            WHEN v.total_applications_submitted >= 1 THEN '4. 1ª Candidatura Concluída'
            WHEN v.total_applications_started >= 1 THEN '3. 1ª Candidatura Iniciada'
            WHEN v.passport_started = true THEN '2. Passaporte Iniciado'
            ELSE '1. Total de Usuários'
        END AS funnel_phase,
        CASE
            WHEN v.total_applications_submitted >= 2 THEN 6
            WHEN v.total_applications_started >= 2 THEN 5
            WHEN v.total_applications_submitted >= 1 THEN 4
            WHEN v.total_applications_started >= 1 THEN 3
            WHEN v.passport_started = true THEN 2
            ELSE 1
        END AS step_order
    FROM public.vw_admin_user_funnel v
    LEFT JOIN auth.users au ON au.id = v.user_id
    ORDER BY step_order DESC, v.full_name ASC;
END;
$function$;
