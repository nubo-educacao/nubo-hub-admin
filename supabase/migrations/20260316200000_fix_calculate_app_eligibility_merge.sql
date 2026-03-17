-- Migration: Fix calculate_application_eligibility to MERGE results
-- Bug: When a user submitted an application, this RPC overwrote their entire `eligibility_results` 
--      array with just the results of the single partner they applied to, deleting the others.
-- Fix: Now it updates only the entry for that specific partner in the existing array.

CREATE OR REPLACE FUNCTION public.calculate_application_eligibility(p_application_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_app_record RECORD;
    v_profile_id UUID;
    v_profile_json JSONB;
    v_form_record RECORD;
    v_partner_results JSONB := '{}'::jsonb;
    v_value JSONB;
    v_met BOOLEAN;
    v_partner_id UUID;
    v_results JSONB;
    v_existing_results JSONB;
    v_merged_results JSONB := '[]'::jsonb;
    v_existing_partner JSONB;
    v_found BOOLEAN := false;
BEGIN
    -- 1. Get application data
    SELECT * INTO v_app_record FROM public.student_applications WHERE id = p_application_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Application not found');
    END IF;

    v_partner_id := v_app_record.partner_id;
    v_profile_id := COALESCE(v_app_record.target_id, v_app_record.user_id);

    -- 2. Get target profile for fallback (age, etc) - also get current eligibility_results
    SELECT to_jsonb(p.*), COALESCE(p.eligibility_results, '[]'::jsonb) 
    INTO v_profile_json, v_existing_results 
    FROM public.user_profiles p 
    WHERE p.id = v_profile_id;

    -- 3. Initialize results for this specific partner
    v_partner_results := jsonb_build_object(
        'partner_id', v_partner_id,
        'partner_name', (SELECT name FROM public.partners WHERE id = v_partner_id),
        'total_criteria', 0,
        'met_criteria', 0,
        'details', '[]'::jsonb
    );

    -- 4. Evaluate each criterion from partner_forms
    FOR v_form_record IN 
        SELECT field_name, mapping_source, criterion_rule 
        FROM public.partner_forms 
        WHERE partner_id = v_partner_id AND is_criterion = true
    LOOP
        BEGIN
            v_value := NULL;
            v_met := false;

            -- Priority 1: Field Name in application answers
            IF v_app_record.answers ? v_form_record.field_name THEN
                v_value := v_app_record.answers -> v_form_record.field_name;
            -- Priority 2: Mapping Source in application answers (agent pre-fill legacy)
            ELSIF v_form_record.mapping_source IS NOT NULL AND v_app_record.answers ? v_form_record.mapping_source THEN
                v_value := v_app_record.answers -> v_form_record.mapping_source;
            -- Priority 3: Fallback to user profile if mapped
            ELSIF v_form_record.mapping_source LIKE 'user_profiles.%' THEN
                v_value := v_profile_json -> split_part(v_form_record.mapping_source, '.', 2);
            END IF;

            -- Only count if value exists
            IF v_value IS NOT NULL AND v_value::text <> 'null' AND v_value::text <> '""' THEN
                -- Increment total criteria
                v_partner_results := jsonb_set(v_partner_results, '{total_criteria}', 
                    to_jsonb((v_partner_results->>'total_criteria')::int + 1));

                -- Evaluation: Real logic evaluation in SQL
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
                                        v_met := (v_val2 @> jsonb_build_array(v_val1) OR v_val2 @> jsonb_build_array(v_val1::text));
                                    WHEN '<' THEN
                                        v_met := (v_val1::text::numeric < v_val2::text::numeric);
                                    WHEN '>' THEN
                                        v_met := (v_val1::text::numeric > v_val2::text::numeric);
                                    WHEN '<=' THEN
                                        v_met := (v_val1::text::numeric <= v_val2::text::numeric);
                                    WHEN '>=' THEN
                                        v_met := (v_val1::text::numeric >= v_val2::text::numeric);
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
                    v_partner_results := jsonb_set(v_partner_results, '{met_criteria}', 
                        to_jsonb((v_partner_results->>'met_criteria')::int + 1));
                END IF;

                -- Add detail
                v_partner_results := jsonb_set(v_partner_results, '{details}', 
                    (v_partner_results->'details') || jsonb_build_object('field', v_form_record.field_name, 'met', v_met));
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error processing criterion % for partner %: %', v_form_record.field_name, v_partner_id, SQLERRM;
        END;
    END LOOP;

    -- 5. Prepare results array (MERGE with existing instead of overwriting)
    v_results := jsonb_build_array(v_partner_results);
    
    -- Loop through existing results to construct the new merged array
    IF jsonb_typeof(v_existing_results) = 'array' THEN
        FOR v_existing_partner IN SELECT * FROM jsonb_array_elements(v_existing_results)
        LOOP
            -- If it's the partner we just updated, use the new results
            IF (v_existing_partner->>'partner_id') = v_partner_id::text THEN
                v_merged_results := v_merged_results || v_partner_results;
                v_found := true;
            -- Otherwise keep the existing partner data
            ELSE
                v_merged_results := v_merged_results || v_existing_partner;
            END IF;
        END LOOP;
        
        -- If partner wasn't in existing results, append it
        IF NOT v_found THEN
            v_merged_results := v_merged_results || v_partner_results;
        END IF;
    ELSE
        -- Fallback if existing is not an array for some reason
        v_merged_results := v_results;
    END IF;

    -- 6. Update user_profiles -- Update the auth user, not necessarily the target
    UPDATE public.user_profiles SET eligibility_results = v_merged_results WHERE id = v_app_record.user_id;

    RETURN v_merged_results;
END;
$$;
