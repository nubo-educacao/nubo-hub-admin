-- Migration: Fix calculate_passport_eligibility to ALWAYS return all partners
-- Bug: Some partners were silently dropped when criterion evaluation failed with an unhandled error
-- Fix: Wrap each criterion evaluation in its own exception block and ensure
--       all initialized partners are always present in the final result

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
    v_student_answers JSONB;
    v_app_record RECORD;
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

    -- 2. Initialize results for ALL partners (this guarantees they all appear)
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
        -- Wrap EACH criterion in its own exception block so one failure doesn't break others
        BEGIN
            v_partner_id := v_form_record.partner_id;
            v_value := NULL;
            v_met := false;

            -- Try to extract value from user profile
            IF v_form_record.mapping_source IS NOT NULL AND v_form_record.mapping_source LIKE 'user_profiles.%' THEN
                v_value := v_profile_json -> split_part(v_form_record.mapping_source, '.', 2);
            END IF;

            -- If no value from profile mapping, try to get from student_application answers
            IF (v_value IS NULL OR v_value::text = 'null' OR v_value::text = '""') THEN
                -- Check if there's a submitted application for this partner
                SELECT answers INTO v_student_answers
                FROM public.student_applications
                WHERE user_id = v_target_id
                  AND partner_id = v_partner_id
                  AND status IN ('SUBMITTED', 'IN_PROGRESS')
                ORDER BY created_at DESC
                LIMIT 1;

                IF v_student_answers IS NOT NULL THEN
                    v_value := v_student_answers -> v_form_record.field_name;
                END IF;
            END IF;

            -- Only count if value exists
            IF v_value IS NOT NULL AND v_value::text <> 'null' AND v_value::text <> '""' THEN
                -- Increment total criteria
                v_partner_results := jsonb_set(v_partner_results, ARRAY[v_partner_id::text, 'total_criteria'], 
                    to_jsonb((v_partner_results->v_partner_id::text->>'total_criteria')::int + 1));

                -- Evaluate criterion rule
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
                    v_partner_results := jsonb_set(v_partner_results, ARRAY[v_partner_id::text, 'met_criteria'], 
                        to_jsonb((v_partner_results->v_partner_id::text->>'met_criteria')::int + 1));
                END IF;

                -- Add detail
                v_partner_results := jsonb_set(v_partner_results, ARRAY[v_partner_id::text, 'details'], 
                    COALESCE(v_partner_results->v_partner_id::text->'details', '[]'::jsonb) || jsonb_build_object('field', v_form_record.field_name, 'met', v_met));
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Log but don't break: this partner's criterion is skipped
            RAISE NOTICE 'Error processing criterion % for partner %: %', v_form_record.field_name, v_partner_id, SQLERRM;
        END;
    END LOOP;

    -- 4. Convert results object to array - ALL partners are guaranteed to be here
    SELECT jsonb_agg(value) INTO v_results FROM jsonb_each(v_partner_results);
    IF v_results IS NULL THEN v_results := '[]'::jsonb; END IF;

    -- 5. Update user_profiles - Store results in the calling user's profile
    UPDATE public.user_profiles SET eligibility_results = v_results WHERE id = p_user_id;

    RETURN v_results;
END;
$$;
