-- Update pre_fill_application to handle auth.users mapping sources
CREATE OR REPLACE FUNCTION public.pre_fill_application(p_user_id uuid, p_partner_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_answers JSONB := '{}'::jsonb;
    v_form_record RECORD;
    v_profile_record RECORD;
    v_preferences_record RECORD;
    v_value JSONB;
    v_application_id UUID;
BEGIN
    -- Get user profile
    SELECT * INTO v_profile_record FROM public.user_profiles WHERE id = p_user_id;
    
    -- Get user preferences
    SELECT * INTO v_preferences_record FROM public.user_preferences WHERE user_id = p_user_id;

    -- Iterate through partner_forms for this specific partner where mapping_source exists
    FOR v_form_record IN 
        SELECT field_name, mapping_source 
        FROM public.partner_forms 
        WHERE partner_id = p_partner_id AND mapping_source IS NOT NULL
    LOOP
        v_value := NULL;
        
        -- Dynamically extract from mapping source
        IF v_form_record.mapping_source LIKE 'user_profiles.%' THEN
            EXECUTE format('SELECT to_jsonb($1.%I)', split_part(v_form_record.mapping_source, '.', 2)) 
            INTO v_value USING v_profile_record;
        ELSIF v_form_record.mapping_source LIKE 'user_preferences.%' THEN
            EXECUTE format('SELECT to_jsonb($1.%I)', split_part(v_form_record.mapping_source, '.', 2)) 
            INTO v_value USING v_preferences_record;
        ELSIF v_form_record.mapping_source LIKE 'auth.users.%' THEN
            -- Special handling for auth.users (restricted schema)
            IF v_form_record.mapping_source = 'auth.users.phone' THEN
                SELECT to_jsonb(u.phone) INTO v_value FROM auth.users u WHERE u.id = p_user_id;
            ELSIF v_form_record.mapping_source = 'auth.users.email' THEN
                 SELECT to_jsonb(u.email) INTO v_value FROM auth.users u WHERE u.id = p_user_id;
            END IF;
        END IF;

        IF v_value IS NOT NULL THEN
            -- Add to the answers JSONB object
            v_answers := jsonb_set(v_answers, ARRAY[v_form_record.field_name], v_value);
        END IF;
    END LOOP;

    -- Insert into student_applications
    INSERT INTO public.student_applications (user_id, partner_id, answers, status)
    VALUES (p_user_id, p_partner_id, v_answers, 'DRAFT')
    RETURNING id INTO v_application_id;

    RETURN v_application_id;
END;
$$;
