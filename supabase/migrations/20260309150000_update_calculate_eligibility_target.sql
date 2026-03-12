-- Migration: update_calculate_eligibility_target
-- Make sure the dependent profile is used if the user has a dependent

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

    -- Explicitly use dependent if current_dependent_id is populated
    IF v_profile_record.current_dependent_id IS NOT NULL THEN
        v_target_id := v_profile_record.current_dependent_id;
    ELSE
        v_target_id := COALESCE(v_profile_record.active_application_target_id, p_user_id);
    END IF;

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

        -- Extract value from target profile using JSON
        IF v_form_record.mapping_source LIKE 'user_profiles.%' THEN
            v_value := v_profile_json -> split_part(v_form_record.mapping_source, '.', 2);
        END IF;

        -- Only count if value exists (matching frontend logic)
        IF v_value IS NOT NULL AND v_value::text <> 'null' AND v_value::text <> '""' THEN
            -- Increment total criteria
            v_partner_results := jsonb_set(v_partner_results, ARRAY[v_partner_id::text, 'total_criteria'], 
                to_jsonb((v_partner_results->v_partner_id::text->>'total_criteria')::int + 1));

            -- Evaluate real logic
            IF v_form_record.criterion_rule IS NULL THEN
                v_met := true;
            ELSE
                BEGIN
                    DECLARE
                        v_op TEXT := (SELECT key FROM jsonb_each(v_form_record.criterion_rule) LIMIT 1);
                        v_args JSONB := v_form_record.criterion_rule -> v_op;
                        v_val1 JSONB;
                        v_val2 JSONB;
                    BEGIN
                        IF jsonb_typeof(v_args) = 'array' THEN
                            v_val1 := v_value;
                            v_val2 := v_args -> 1;
                            
                            CASE v_op
                                WHEN '==' THEN
                                    v_met := (v_val1 = v_val2 OR v_val1::text = v_val2::text);
                                WHEN 'in' THEN
                                    -- Check if value is in array
                                    v_met := (v_val2 @> jsonb_build_array(v_val1) OR v_val2 @> jsonb_build_array(v_val1::text));
                                WHEN '<' THEN
                                    v_met := (v_val1::text::numeric < v_val2::text::numeric);
                                WHEN '>' THEN
                                    v_met := (v_val1::text::numeric > v_val2::text::numeric);
                                ELSE
                                    v_met := true;
                            END CASE;
                        ELSE
                            v_met := true;
                        END IF;
                    END;
                EXCEPTION WHEN OTHERS THEN
                    v_met := false;
                END;
            END IF;

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

    -- 5. Update user_profiles - Store results in the calling user's profile
    UPDATE public.user_profiles SET eligibility_results = v_results WHERE id = p_user_id;

    RETURN v_results;
END;
$$;
