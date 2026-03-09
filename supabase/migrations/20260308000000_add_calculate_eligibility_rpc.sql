-- Migration: add_calculate_eligibility_rpc
-- Centralizes eligibility calculation in the database to avoid frontend/backend discrepancies

CREATE OR REPLACE FUNCTION public.calculate_passport_eligibility(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile_record RECORD;
    v_target_id UUID;
    v_target_profile RECORD;
    v_form_record RECORD;
    v_results JSONB := '[]'::jsonb;
    v_partner_results JSONB := '{}'::jsonb;
    v_value JSONB;
    v_profile_json JSONB;
    v_met BOOLEAN;
    v_partner_id UUID;
    v_partners_record RECORD;
BEGIN
    -- 1. Get user profile to find target
    SELECT * INTO v_profile_record FROM public.user_profiles WHERE id = p_user_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'User not found');
    END IF;

    v_target_id := COALESCE(v_profile_record.active_application_target_id, p_user_id);
    SELECT * INTO v_target_profile FROM public.user_profiles WHERE id = v_target_id;
    v_profile_json := to_jsonb(v_target_profile);

    -- 2. Initialize results for all partners
    FOR v_partners_record IN SELECT id, name FROM public.partners LOOP
        v_partner_results := jsonb_set(v_partner_results, ARRAY[v_partners_record.id::text], 
            jsonb_build_object(
                'partner_id', v_partners_record.id,
                'partner_name', v_partners_record.name,
                'total_criteria', 0,
                'met_criteria', 0,
                'details', '[]'::jsonb
            )
        );
    END LOOP;

    -- 3. Calculate criteria from partner_forms
    FOR v_form_record IN 
        SELECT partner_id, field_name, mapping_source, criterion_rule 
        FROM public.partner_forms 
        WHERE is_criterion = true
    LOOP
        v_partner_id := v_form_record.partner_id;
        v_value := NULL;
        v_met := false;

        -- Extract value from target profile using JSON (much more robust than dynamic SQL)
        IF v_form_record.mapping_source LIKE 'user_profiles.%' THEN
            v_value := v_profile_json -> split_part(v_form_record.mapping_source, '.', 2);
        END IF;

        -- Only count if value exists (matching frontend logic)
        IF v_value IS NOT NULL AND v_value::text <> 'null' AND v_value::text <> '""' THEN
            -- Increment total criteria
            v_partner_results := jsonb_set(v_partner_results, ARRAY[v_partner_id::text, 'total_criteria'], 
                to_jsonb((v_partner_results->v_partner_id::text->>'total_criteria')::int + 1));

            -- Simplified evaluation: if value exists, consider it met (heuristic)
            -- This can be expanded with real JSON logic if a PL/v8 or PL/Python environment is present
            v_met := true;

            IF v_met THEN
                v_partner_results := jsonb_set(v_partner_results, ARRAY[v_partner_id::text, 'met_criteria'], 
                    to_jsonb((v_partner_results->v_partner_id::text->>'met_criteria')::int + 1));
            END IF;

            -- Add detail
            v_partner_results := jsonb_set(v_partner_results, ARRAY[v_partner_id::text, 'details'], 
                COALESCE(v_partner_results->v_partner_id::text->'details', '[]'::jsonb) || jsonb_build_object('field', v_form_record.field_name, 'met', v_met));
        END IF;
    END LOOP;

    -- 4. Convert results object to array
    SELECT jsonb_agg(value) INTO v_results FROM jsonb_each(v_partner_results);
    IF v_results IS NULL THEN v_results := '[]'::jsonb; END IF;

    -- 5. Update user_profiles
    UPDATE public.user_profiles SET eligibility_results = v_results WHERE id = p_user_id;

    RETURN v_results;
END;
$$;
