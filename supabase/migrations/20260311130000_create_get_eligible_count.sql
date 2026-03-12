-- Conta user_profiles com eligibility_results que atendem TODOS os critérios daquele partner
CREATE OR REPLACE FUNCTION public.get_eligible_count_for_partner(p_partner_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count BIGINT;
BEGIN
    SELECT COUNT(DISTINCT up.id) INTO v_count
    FROM public.user_profiles up,
         jsonb_array_elements(up.eligibility_results) AS elem
    WHERE (elem->>'partner_id')::uuid = p_partner_id
      AND (elem->>'met_criteria')::int = (elem->>'total_criteria')::int
      AND (elem->>'total_criteria')::int > 0;
      
    RETURN v_count;
END;
$$;
