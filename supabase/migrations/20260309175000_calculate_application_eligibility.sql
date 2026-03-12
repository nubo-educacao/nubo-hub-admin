-- Migration: calculate_application_eligibility
-- This function calculates eligibility based on a specific student application's answers
-- rather than just the user profile data.

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
    v_results JSONB := '[]'::jsonb;
BEGIN
    -- 1. Get application data
    SELECT * INTO v_app_record FROM public.student_applications WHERE id = p_application_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Application not found');
    END IF;

    v_partner_id := v_app_record.partner_id;
    v_profile_id := v_app_record.user_id;

    -- 2. Get target profile for fallback (age, etc)
    SELECT to_jsonb(p.*) INTO v_profile_json FROM public.user_profiles p WHERE p.id = v_profile_id;

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
    END LOOP;

    -- 5. Prepare results array (standardizing format for eligibility_results column)
    v_results := jsonb_build_array(v_partner_results);

    -- 6. Update user_profiles
    UPDATE public.user_profiles SET eligibility_results = v_results WHERE id = v_profile_id;

    RETURN v_results;
END;
$$;
