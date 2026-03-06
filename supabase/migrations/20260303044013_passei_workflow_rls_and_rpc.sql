-- 0. Ensure missing columns exist
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS passport_phase TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS workflow_data JSONB;

-- 1. Add CHECK constraint on user_profiles.passport_phase
ALTER TABLE public.user_profiles 
ADD CONSTRAINT user_profiles_passport_phase_check 
CHECK (passport_phase IN ('INTRO', 'ONBOARDING', 'ASK_DEPENDENT', 'DEPENDENT_ONBOARDING', 'PROGRAM_MATCH', 'EVALUATE', 'CONCLUDED'));

-- 2. Enable RLS on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Note: user_profiles already has policies according to our check:
-- "Users can view own profile" (SELECT)
-- "Users can insert own profile" (INSERT)
-- "Users can update own profile" (UPDATE)

-- 3. Enable RLS on student_applications
ALTER TABLE public.student_applications ENABLE ROW LEVEL SECURITY;

-- Add policies for student_applications
DROP POLICY IF EXISTS "Users can view own applications" ON public.student_applications;
CREATE POLICY "Users can view own applications" ON public.student_applications 
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own applications" ON public.student_applications;
CREATE POLICY "Users can insert own applications" ON public.student_applications 
FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own applications" ON public.student_applications;
CREATE POLICY "Users can update own applications" ON public.student_applications 
FOR UPDATE USING (auth.uid() = user_id);

-- 4. Enable RLS on partner_forms
ALTER TABLE public.partner_forms ENABLE ROW LEVEL SECURITY;

-- Add policies for partner_forms (Everyone needs to read forms)
DROP POLICY IF EXISTS "Anyone can view partner forms" ON public.partner_forms;
CREATE POLICY "Anyone can view partner forms" ON public.partner_forms 
FOR SELECT USING (true);


-- 5. Create the RPC pre_fill_application
CREATE OR REPLACE FUNCTION public.pre_fill_application(p_user_id UUID, p_partner_id UUID)
RETURNS UUID
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
