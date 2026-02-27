-- ============================================================
-- 96_equalize_dev_from_prod.sql
-- Equaliza o schema do DEV com o PROD
-- Aplica somente no banco de STAGING/DEV
-- ============================================================

-- ============================================================
-- PARTE 1: TABELAS FALTANTES NO DEV
-- ============================================================

-- 1.1 ai_insights
CREATE TABLE IF NOT EXISTS public.ai_insights (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  insights jsonb NOT NULL,
  data_context jsonb NOT NULL,
  data_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 1.2 nubo_student_whitelist
CREATE TABLE IF NOT EXISTS public.nubo_student_whitelist (
  phone_number text NOT NULL PRIMARY KEY,
  created_at timestamptz DEFAULT now()
);

-- 1.3 partner_steps (deve vir antes de partner_forms por FK)
CREATE TABLE IF NOT EXISTS public.partner_steps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id uuid NOT NULL REFERENCES public.partners(id),
  step_name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- 1.4 partner_forms
CREATE TABLE IF NOT EXISTS public.partner_forms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id uuid NOT NULL REFERENCES public.partners(id),
  field_name text NOT NULL,
  question_text text NOT NULL,
  data_type text NOT NULL DEFAULT 'text',
  options jsonb,
  mapping_source text,
  is_criterion boolean NOT NULL DEFAULT false,
  criterion_rule jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  step_id uuid REFERENCES public.partner_steps(id)
);

-- 1.5 partners_users
CREATE TABLE IF NOT EXISTS public.partners_users (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  partner_id uuid NOT NULL REFERENCES public.partners(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, partner_id)
);

-- 1.6 student_applications
CREATE TABLE IF NOT EXISTS public.student_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  partner_id uuid NOT NULL REFERENCES public.partners(id),
  status text NOT NULL DEFAULT 'started',
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 1.7 sean_ellis_score
CREATE TABLE IF NOT EXISTS public.sean_ellis_score (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submitted_at timestamptz,
  full_name text,
  whatsapp_raw text,
  whatsapp_normalized text,
  sisu_subscribed text,
  sisu_courses text,
  sisu_status text,
  sisu_cloudinha_influence text,
  prouni_subscribed text,
  prouni_courses text,
  prouni_cloudinha_influence text,
  prouni_status text,
  disappointment_level text,
  feedback text,
  user_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 1.8 user_rate_limits
CREATE TABLE IF NOT EXISTS public.user_rate_limits (
  user_id uuid NOT NULL PRIMARY KEY,
  last_message_at timestamptz DEFAULT now(),
  message_count_window integer DEFAULT 0
);


-- ============================================================
-- PARTE 2: COLUNAS FALTANTES NO DEV
-- ============================================================

-- user_profiles.is_nubo_student
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_nubo_student boolean DEFAULT false;


-- ============================================================
-- PARTE 3: TRIGGERS FALTANTES NO DEV
-- ============================================================

-- partner_forms updated_at trigger
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_partner_forms_updated_at'
  ) THEN
    CREATE TRIGGER update_partner_forms_updated_at
      BEFORE UPDATE ON public.partner_forms
      FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
  END IF;
END $$;

-- student_applications updated_at trigger
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_student_applications_updated_at'
  ) THEN
    CREATE TRIGGER update_student_applications_updated_at
      BEFORE UPDATE ON public.student_applications
      FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
  END IF;
END $$;


-- ============================================================
-- PARTE 4: VIEW FALTANTE NO DEV
-- ============================================================

CREATE OR REPLACE VIEW public.vw_favorite_courses_ranking AS
  SELECT c.id AS course_id,
    c.course_name,
    cp.name AS campus_name,
    i.name AS institution_name,
    count(uf.user_id) AS sum_user
  FROM user_favorites uf
    JOIN courses c ON uf.course_id = c.id
    JOIN campus cp ON c.campus_id = cp.id
    JOIN institutions i ON cp.institution_id = i.id
  WHERE uf.course_id IS NOT NULL
  GROUP BY c.id, c.course_name, cp.name, i.name
  ORDER BY (count(uf.user_id)) DESC;


-- ============================================================
-- PARTE 5: FUNÇÕES/RPCs FALTANTES NO DEV
-- ============================================================

-- 5.1 clean_phone_number
CREATE OR REPLACE FUNCTION public.clean_phone_number(input_phone text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
    RETURN regexp_replace(input_phone, '\D', '', 'g');
END;
$function$;

-- 5.2 normalize_whatsapp
CREATE OR REPLACE FUNCTION public.normalize_whatsapp(phone text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
    clean_phone TEXT;
BEGIN
    clean_phone := regexp_replace(phone, '\D', '', 'g');
    IF length(clean_phone) BETWEEN 10 AND 11 THEN
        clean_phone := '55' || clean_phone;
    END IF;
    RETURN clean_phone;
END;
$function$;

-- 5.3 check_nubo_student_eligibility (trigger function)
CREATE OR REPLACE FUNCTION public.check_nubo_student_eligibility()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    user_phone TEXT;
    clean_user_phone TEXT;
BEGIN
    SELECT phone INTO user_phone
    FROM auth.users
    WHERE id = NEW.id;

    IF user_phone IS NOT NULL THEN
        clean_user_phone := public.clean_phone_number(user_phone);
        PERFORM 1 
        FROM public.nubo_student_whitelist
        WHERE clean_user_phone LIKE '%' || phone_number;
        IF FOUND THEN
            NEW.is_nubo_student := TRUE;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;

-- 5.3b Trigger for check_nubo_student_eligibility
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'before_insert_user_profiles_check_nubo'
  ) THEN
    CREATE TRIGGER before_insert_user_profiles_check_nubo
      BEFORE INSERT ON public.user_profiles
      FOR EACH ROW EXECUTE FUNCTION check_nubo_student_eligibility();
  END IF;
END $$;

-- 5.4 has_permission
CREATE OR REPLACE FUNCTION public.has_permission(p_permission text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_permissions
        WHERE user_id = auth.uid()
        AND permission = p_permission
    );
END;
$function$;

-- 5.5 has_dashboard_permission
CREATE OR REPLACE FUNCTION public.has_dashboard_permission()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_permissions
        WHERE user_id = auth.uid()
        AND permission = 'Dashboard'
    );
END;
$function$;

-- 5.6 is_backoffice_admin
CREATE OR REPLACE FUNCTION public.is_backoffice_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_permissions 
        WHERE user_id = auth.uid() 
        AND permission = 'Controle de usuários'
    );
END;
$function$;

-- 5.7 get_my_partner_id
CREATE OR REPLACE FUNCTION public.get_my_partner_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT partner_id
  FROM public.partners_users
  WHERE user_id = auth.uid()
  LIMIT 1;
$function$;

-- 5.8 set_partner_role_and_link
CREATE OR REPLACE FUNCTION public.set_partner_role_and_link(p_user_id uuid, p_partner_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
     RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE auth.users
  SET role = 'partner'
  WHERE id = p_user_id;

  INSERT INTO public.partners_users (user_id, partner_id)
  VALUES (p_user_id, p_partner_id)
  ON CONFLICT (user_id, partner_id) DO NOTHING;
END;
$function$;

-- 5.9 get_partner_users
CREATE OR REPLACE FUNCTION public.get_partner_users(p_partner_id text)
 RETURNS TABLE(id uuid, user_id uuid, email text, created_at timestamptz)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        pu.id,
        pu.user_id,
        u.email::TEXT,
        pu.created_at
    FROM 
        public.partners_users pu
    JOIN 
        auth.users u ON pu.user_id = u.id
    WHERE 
        pu.partner_id = p_partner_id::UUID
    ORDER BY 
        pu.created_at DESC;
END;
$function$;

-- 5.10 manage_partner (version with delete support)
CREATE OR REPLACE FUNCTION public.manage_partner(
  p_id uuid DEFAULT NULL, p_name text DEFAULT NULL, p_description text DEFAULT NULL,
  p_location text DEFAULT NULL, p_type text DEFAULT NULL, p_income text DEFAULT NULL,
  p_dates jsonb DEFAULT NULL, p_link text DEFAULT NULL, p_coverimage text DEFAULT NULL,
  p_delete boolean DEFAULT false
)
 RETURNS partners
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_partner public.partners;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = auth.uid() AND permission = 'Dashboard') THEN
        RAISE EXCEPTION 'Acesso negado.';
    END IF;
    IF p_delete AND p_id IS NOT NULL THEN
        DELETE FROM public.partners WHERE id = p_id RETURNING * INTO v_partner;
    ELSIF p_id IS NULL THEN
        INSERT INTO public.partners (name, description, location, type, income, dates, link, coverimage)
        VALUES (p_name, p_description, p_location, p_type, p_income, p_dates, p_link, p_coverimage) RETURNING * INTO v_partner;
    ELSE
        UPDATE public.partners SET name = COALESCE(p_name, name), description = COALESCE(p_description, description),
        location = COALESCE(p_location, location), type = COALESCE(p_type, type), income = COALESCE(p_income, income),
        dates = COALESCE(p_dates, dates), link = COALESCE(p_link, link), coverimage = COALESCE(p_coverimage, coverimage),
        updated_at = NOW() WHERE id = p_id RETURNING * INTO v_partner;
        IF NOT FOUND THEN RAISE EXCEPTION 'Parceiro não encontrado.'; END IF;
    END IF;
    RETURN v_partner;
END;
$function$;

-- 5.11 manage_important_date
CREATE OR REPLACE FUNCTION public.manage_important_date(
  p_id uuid DEFAULT NULL, p_title text DEFAULT NULL, p_description text DEFAULT NULL,
  p_start_date timestamptz DEFAULT NULL, p_end_date timestamptz DEFAULT NULL,
  p_type text DEFAULT NULL, p_delete boolean DEFAULT false
)
 RETURNS important_dates
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_date public.important_dates;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.user_permissions
        WHERE user_id = auth.uid()
        AND permission = 'Calendário'
    ) THEN
        RAISE EXCEPTION 'Acesso negado. Permissão insuficiente.';
    END IF;
    IF p_delete AND p_id IS NOT NULL THEN
        DELETE FROM public.important_dates WHERE id = p_id RETURNING * INTO v_date;
        IF NOT FOUND THEN RAISE EXCEPTION 'Data não encontrada.'; END IF;
        RETURN v_date;
    ELSIF p_id IS NULL THEN
        INSERT INTO public.important_dates (title, description, start_date, end_date, type)
        VALUES (p_title, p_description, p_start_date, p_end_date, p_type) RETURNING * INTO v_date;
    ELSE
        UPDATE public.important_dates SET
            title = COALESCE(p_title, title), description = COALESCE(p_description, description),
            start_date = COALESCE(p_start_date, start_date), end_date = COALESCE(p_end_date, end_date),
            type = COALESCE(p_type, type)
        WHERE id = p_id RETURNING * INTO v_date;
        IF NOT FOUND THEN RAISE EXCEPTION 'Data não encontrada.'; END IF;
    END IF;
    RETURN v_date;
END;
$function$;

-- 5.12 bulk_import_important_dates
CREATE OR REPLACE FUNCTION public.bulk_import_important_dates(p_dates jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_count INTEGER := 0;
    v_item JSONB;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.user_permissions
        WHERE user_id = auth.uid()
        AND permission = 'Calendário'
    ) THEN
        RAISE EXCEPTION 'Acesso negado. Permissão insuficiente.';
    END IF;
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_dates)
    LOOP
        INSERT INTO public.important_dates (title, description, start_date, end_date, type)
        VALUES (
            v_item->>'title',
            v_item->>'description',
            (v_item->>'start_date')::timestamptz,
            NULLIF(v_item->>'end_date', '')::timestamptz,
            v_item->>'type'
        );
        v_count := v_count + 1;
    END LOOP;
    RETURN v_count;
END;
$function$;

-- 5.13 import_nubo_students
CREATE OR REPLACE FUNCTION public.import_nubo_students(students jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    student_record JSONB;
    raw_phone TEXT;
    cleaned_phone TEXT;
    count_imported INTEGER := 0;
    count_updated_users INTEGER := 0;
BEGIN
    FOR student_record IN SELECT * FROM jsonb_array_elements(students)
    LOOP
        raw_phone := student_record->>'Phone';
        IF raw_phone IS NOT NULL AND raw_phone <> '' THEN
            cleaned_phone := public.clean_phone_number(raw_phone);
            INSERT INTO public.nubo_student_whitelist (phone_number)
            VALUES (cleaned_phone)
            ON CONFLICT (phone_number) DO NOTHING;
            count_imported := count_imported + 1;
        END IF;
    END LOOP;

    WITH matched_users AS (
        SELECT up.id
        FROM public.user_profiles up
        JOIN auth.users au ON up.id = au.id
        JOIN public.nubo_student_whitelist nsw 
            ON public.clean_phone_number(au.phone) LIKE '%' || nsw.phone_number
        WHERE up.is_nubo_student IS FALSE
    )
    UPDATE public.user_profiles
    SET is_nubo_student = TRUE
    WHERE id IN (SELECT id FROM matched_users);
    
    GET DIAGNOSTICS count_updated_users = ROW_COUNT;

    RETURN jsonb_build_object(
        'imported_whitelist_entries', count_imported,
        'updated_existing_profiles', count_updated_users
    );
END;
$function$;

-- 5.14 import_sean_ellis_data
CREATE OR REPLACE FUNCTION public.import_sean_ellis_data(data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
    row_data JSONB;
    v_submitted_at TIMESTAMPTZ;
    v_full_name TEXT;
    v_whatsapp_raw TEXT;
    v_whatsapp_normalized TEXT;
    v_user_id UUID;
    v_count INTEGER := 0;
BEGIN
    FOR row_data IN SELECT * FROM jsonb_array_elements(data)
    LOOP
        v_full_name := row_data->>'full_name';
        v_whatsapp_raw := row_data->>'whatsapp_raw';
        v_whatsapp_normalized := public.normalize_whatsapp(v_whatsapp_raw);
        v_user_id := NULL;
        
        SELECT id INTO v_user_id FROM auth.users 
        WHERE phone = v_whatsapp_normalized 
           OR phone = '+' || v_whatsapp_normalized
           OR phone LIKE '%' || v_whatsapp_normalized
        LIMIT 1;

        INSERT INTO public.sean_ellis_score (
            submitted_at, full_name, whatsapp_raw, whatsapp_normalized,
            sisu_subscribed, sisu_courses, sisu_status, sisu_cloudinha_influence,
            prouni_subscribed, prouni_courses, prouni_cloudinha_influence, prouni_status,
            disappointment_level, feedback, user_id
        ) VALUES (
            to_timestamp(row_data->>'submitted_at', 'DD/MM/YYYY HH24:MI:SS'),
            v_full_name, v_whatsapp_raw, v_whatsapp_normalized,
            row_data->>'sisu_subscribed', row_data->>'sisu_courses',
            row_data->>'sisu_status', row_data->>'sisu_cloudinha_influence',
            row_data->>'prouni_subscribed', row_data->>'prouni_courses',
            row_data->>'prouni_cloudinha_influence', row_data->>'prouni_status',
            row_data->>'disappointment_level', row_data->>'feedback', v_user_id
        );
        v_count := v_count + 1;
    END LOOP;
    RETURN jsonb_build_object('success', true, 'count', v_count);
END;
$function$;

-- 5.15 get_sean_ellis_data (versão com sort)
CREATE OR REPLACE FUNCTION public.get_sean_ellis_data(
  p_page integer, p_page_size integer, p_filter_name text DEFAULT NULL,
  p_filter_city text DEFAULT NULL, p_filter_education text DEFAULT NULL,
  p_filter_is_nubo_student boolean DEFAULT NULL,
  p_filter_income_min numeric DEFAULT NULL, p_filter_income_max numeric DEFAULT NULL,
  p_filter_quota_types text[] DEFAULT NULL,
  p_sort_by text DEFAULT 'submitted_at', p_sort_order text DEFAULT 'desc'
)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_offset int;
  v_total_count bigint;
  v_data json;
  v_order_clause text;
BEGIN
  v_offset := p_page * p_page_size;
  v_order_clause := CASE p_sort_by
    WHEN 'full_name' THEN 's.full_name'
    WHEN 'identified' THEN 's.user_id'
    WHEN 'disappointment_level' THEN 's.disappointment_level'
    WHEN 'sisu_subscribed' THEN 's.sisu_subscribed'
    WHEN 'prouni_subscribed' THEN 's.prouni_subscribed'
    ELSE 's.submitted_at'
  END;
  SELECT count(DISTINCT s.id) INTO v_total_count
  FROM public.sean_ellis_score s
  LEFT JOIN public.user_profiles p ON s.user_id = p.id
  LEFT JOIN public.user_preferences pref ON s.user_id = pref.user_id
  WHERE (p_filter_name IS NULL OR s.full_name ILIKE '%' || p_filter_name || '%' OR p.full_name ILIKE '%' || p_filter_name || '%')
    AND (p_filter_city IS NULL OR p.city ILIKE '%' || p_filter_city || '%')
    AND (p_filter_education IS NULL OR p.education ILIKE '%' || p_filter_education || '%')
    AND (p_filter_is_nubo_student IS NULL OR p.is_nubo_student = p_filter_is_nubo_student)
    AND (p_filter_income_min IS NULL OR pref.family_income_per_capita >= p_filter_income_min)
    AND (p_filter_income_max IS NULL OR pref.family_income_per_capita <= p_filter_income_max)
    AND (p_filter_quota_types IS NULL OR pref.quota_types && p_filter_quota_types);
  EXECUTE format('
    SELECT coalesce(json_agg(t.*), ''[]''::json)
    FROM (
        SELECT s.*
        FROM public.sean_ellis_score s
        LEFT JOIN public.user_profiles p ON s.user_id = p.id
        LEFT JOIN public.user_preferences pref ON s.user_id = pref.user_id
        WHERE ($1 IS NULL OR s.full_name ILIKE ''%%'' || $1 || ''%%'' OR p.full_name ILIKE ''%%'' || $1 || ''%%'')
          AND ($2 IS NULL OR p.city ILIKE ''%%'' || $2 || ''%%'')
          AND ($3 IS NULL OR p.education ILIKE ''%%'' || $3 || ''%%'')
          AND ($4 IS NULL OR p.is_nubo_student = $4)
          AND ($5 IS NULL OR pref.family_income_per_capita >= $5)
          AND ($6 IS NULL OR pref.family_income_per_capita <= $6)
          AND ($7 IS NULL OR pref.quota_types && $7)
        ORDER BY %s %s
        LIMIT $8 OFFSET $9
    ) t',
    v_order_clause,
    CASE WHEN lower(p_sort_order) = 'asc' THEN 'ASC' ELSE 'DESC' END
  ) USING p_filter_name, p_filter_city, p_filter_education, p_filter_is_nubo_student,
          p_filter_income_min, p_filter_income_max, p_filter_quota_types, p_page_size, v_offset
  INTO v_data;
  RETURN json_build_object('data', v_data, 'count', v_total_count);
END;
$function$;

-- 5.16 get_sean_ellis_stats
CREATE OR REPLACE FUNCTION public.get_sean_ellis_stats(
  p_filter_name text DEFAULT NULL, p_filter_city text DEFAULT NULL,
  p_filter_education text DEFAULT NULL, p_filter_is_nubo_student boolean DEFAULT NULL,
  p_filter_income_min numeric DEFAULT NULL, p_filter_income_max numeric DEFAULT NULL,
  p_filter_quota_types text[] DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
    total_respondents INTEGER;
    total_identified_users INTEGER;
    disappointment_distribution JSONB;
BEGIN
    SELECT COUNT(s.id), COUNT(s.user_id)
    INTO total_respondents, total_identified_users
    FROM public.sean_ellis_score s
    LEFT JOIN public.user_profiles p ON s.user_id = p.id
    LEFT JOIN public.user_preferences pref ON s.user_id = pref.user_id
    WHERE (p_filter_name IS NULL OR s.full_name ILIKE '%' || p_filter_name || '%' OR p.full_name ILIKE '%' || p_filter_name || '%')
      AND (p_filter_city IS NULL OR p.city ILIKE '%' || p_filter_city || '%')
      AND (p_filter_education IS NULL OR p.education ILIKE '%' || p_filter_education || '%')
      AND (p_filter_is_nubo_student IS NULL OR p.is_nubo_student = p_filter_is_nubo_student)
      AND (p_filter_income_min IS NULL OR pref.family_income_per_capita >= p_filter_income_min)
      AND (p_filter_income_max IS NULL OR pref.family_income_per_capita <= p_filter_income_max)
      AND (p_filter_quota_types IS NULL OR pref.quota_types && p_filter_quota_types);

    SELECT jsonb_object_agg(t.disappointment_level, t.count) INTO disappointment_distribution
    FROM (
        SELECT s.disappointment_level, COUNT(*) as count
        FROM public.sean_ellis_score s
        LEFT JOIN public.user_profiles p ON s.user_id = p.id
        LEFT JOIN public.user_preferences pref ON s.user_id = pref.user_id
        WHERE (p_filter_name IS NULL OR s.full_name ILIKE '%' || p_filter_name || '%' OR p.full_name ILIKE '%' || p_filter_name || '%')
          AND (p_filter_city IS NULL OR p.city ILIKE '%' || p_filter_city || '%')
          AND (p_filter_education IS NULL OR p.education ILIKE '%' || p_filter_education || '%')
          AND (p_filter_is_nubo_student IS NULL OR p.is_nubo_student = p_filter_is_nubo_student)
          AND (p_filter_income_min IS NULL OR pref.family_income_per_capita >= p_filter_income_min)
          AND (p_filter_income_max IS NULL OR pref.family_income_per_capita <= p_filter_income_max)
          AND (p_filter_quota_types IS NULL OR pref.quota_types && p_filter_quota_types)
        GROUP BY s.disappointment_level
    ) t;

    RETURN jsonb_build_object(
        'total_respondents', total_respondents,
        'total_identified_users', total_identified_users,
        'disappointment_distribution', COALESCE(disappointment_distribution, '{}'::jsonb)
    );
END;
$function$;

-- 5.17 get_chat_analytics_summary
CREATE OR REPLACE FUNCTION public.get_chat_analytics_summary(p_date_from timestamptz, p_date_to timestamptz)
 RETURNS TABLE(user_id uuid, user_name text, city text, age integer, funnel_stage text, last_activity timestamptz, total_messages bigint, workflow text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    WITH msg_stats AS (
        SELECT 
            cm.user_id,
            count(*) as total_msgs,
            max(cm.created_at) as last_act,
            bool_or(cm.workflow = 'match_workflow') as has_match_started,
            bool_or(cm.workflow IN ('sisu_workflow', 'prouni_workflow', 'fies_workflow')) as has_specific_flow,
            (array_agg(cm.workflow ORDER BY cm.created_at DESC) FILTER (WHERE cm.workflow IS NOT NULL))[1] as last_workflow
        FROM chat_messages cm
        WHERE cm.created_at >= p_date_from AND cm.created_at <= p_date_to AND cm.user_id IS NOT NULL
        GROUP BY cm.user_id
    ),
    fav_stats AS (
        SELECT uf.user_id FROM user_favorites uf GROUP BY uf.user_id
    )
    SELECT 
        ms.user_id,
        COALESCE(p.full_name, 'Usuário Anônimo') as user_name,
        p.city,
        p.age,
        CASE 
            WHEN ms.has_specific_flow THEN 'Fluxo Específico'
            WHEN fs.user_id IS NOT NULL THEN 'Salvaram Favoritos'
            WHEN (pref.workflow_data IS NOT NULL AND pref.workflow_data != '{}'::jsonb) THEN 'Match Realizado'
            WHEN ms.has_match_started THEN 'Match Iniciado'
            WHEN (pref.enem_score IS NOT NULL AND pref.enem_score > 0) THEN 'Preferências Definidas'
            WHEN p.onboarding_completed THEN 'Onboarding Completo'
            ELSE 'Cadastrados'
        END as funnel_stage,
        ms.last_act as last_activity,
        ms.total_msgs as total_messages,
        ms.last_workflow as workflow
    FROM msg_stats ms
    LEFT JOIN user_profiles p ON ms.user_id = p.id
    LEFT JOIN user_preferences pref ON ms.user_id = pref.user_id
    LEFT JOIN fav_stats fs ON ms.user_id = fs.user_id
    ORDER BY ms.last_act DESC;
END;
$function$;

-- 5.18 get_influencer_affiliates
CREATE OR REPLACE FUNCTION public.get_influencer_affiliates(influencer_code text)
 RETURNS TABLE(id uuid, full_name text, phone text, age integer, city text, created_at timestamptz, last_sign_in_at timestamptz)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
    RETURN QUERY SELECT up.id, up.full_name, u.phone, up.age, up.city, u.created_at, u.last_sign_in_at
    FROM public.user_profiles up JOIN auth.users u ON up.id = u.id WHERE up.referral_source = influencer_code ORDER BY u.created_at DESC;
END;
$function$;

-- 5.19 get_influencer_dashboard_stats
CREATE OR REPLACE FUNCTION public.get_influencer_dashboard_stats()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    total_affiliates BIGINT;
    best_influencer_name TEXT;
    best_influencer_count BIGINT;
    influencer_count BIGINT;
    result JSON;
BEGIN
    SELECT COUNT(*) INTO total_affiliates FROM public.user_profiles WHERE referral_source IS NOT NULL;
    SELECT i.name, COUNT(up.id) as cnt INTO best_influencer_name, best_influencer_count
    FROM public.influencers i JOIN public.user_profiles up ON i.code = up.referral_source
    GROUP BY i.name ORDER BY cnt DESC LIMIT 1;
    SELECT COUNT(*) INTO influencer_count FROM public.influencers WHERE active = TRUE;
    result := json_build_object(
        'total_affiliates', total_affiliates,
        'best_influencer', COALESCE(best_influencer_name, 'Nenhum'),
        'avg_affiliates', CASE WHEN influencer_count > 0 THEN (total_affiliates::FLOAT / influencer_count) ELSE 0 END
    );
    RETURN result;
END;
$function$;

-- 5.20 get_influencer_stats
CREATE OR REPLACE FUNCTION public.get_influencer_stats(p_sort_by text DEFAULT 'name', p_sort_order text DEFAULT 'asc')
 RETURNS TABLE(id uuid, name text, code text, active boolean, affiliate_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_order_clause TEXT;
BEGIN
    v_order_clause := CASE p_sort_by
        WHEN 'name' THEN 'i.name'
        WHEN 'code' THEN 'i.code'
        WHEN 'affiliate_count' THEN 'COUNT(up.id)'
        ELSE 'i.name'
    END;
    RETURN QUERY EXECUTE format('
        SELECT i.id, i.name, i.code, i.active, COUNT(up.id) as affiliate_count
        FROM public.influencers i LEFT JOIN public.user_profiles up ON i.code = up.referral_source
        WHERE i.active = TRUE GROUP BY i.id, i.name, i.code, i.active
        ORDER BY %s %s',
        v_order_clause,
        CASE WHEN lower(p_sort_order) = 'desc' THEN 'DESC' ELSE 'ASC' END
    );
END;
$function$;

-- 5.21 get_student_applications_with_details
CREATE OR REPLACE FUNCTION public.get_student_applications_with_details(p_partner_id uuid DEFAULT NULL)
 RETURNS TABLE(id uuid, user_id uuid, partner_id uuid, partner_name text, full_name text, phone text, status text, answers jsonb, created_at timestamptz)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
    RETURN QUERY
    SELECT sa.id, sa.user_id, sa.partner_id, p.name AS partner_name,
        up.full_name, u.phone, sa.status, sa.answers, sa.created_at
    FROM public.student_applications sa
    LEFT JOIN public.user_profiles up ON sa.user_id = up.id
    LEFT JOIN auth.users u ON sa.user_id = u.id
    LEFT JOIN public.partners p ON sa.partner_id = p.id
    WHERE (p_partner_id IS NULL OR sa.partner_id = p_partner_id)
    ORDER BY sa.created_at DESC;
END;
$function$;

-- 5.22 get_student_stats
CREATE OR REPLACE FUNCTION public.get_student_stats(
  filter_full_name text DEFAULT NULL, filter_city text DEFAULT NULL,
  filter_education text DEFAULT NULL, filter_is_nubo_student boolean DEFAULT NULL,
  filter_income_min numeric DEFAULT NULL, filter_income_max numeric DEFAULT NULL,
  filter_quota_types text[] DEFAULT NULL, filter_state text DEFAULT NULL,
  filter_age_min integer DEFAULT NULL, filter_age_max integer DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE total_count INTEGER; unique_cities INTEGER; unique_states INTEGER; avg_age NUMERIC; v_sql TEXT;
BEGIN
    v_sql := format('SELECT COUNT(DISTINCT p.id), COUNT(DISTINCT p.city), COUNT(DISTINCT p.state), COALESCE(AVG(p.age) FILTER (WHERE p.age > 0 AND p.age < 120), 0) FROM public.user_profiles p LEFT JOIN public.user_preferences pref ON p.id = pref.user_id WHERE 1=1 %s %s %s %s %s %s %s %s %s %s', 
    CASE WHEN filter_full_name IS NOT NULL AND filter_full_name <> '' THEN ' AND p.full_name ILIKE ' || quote_literal('%' || filter_full_name || '%') ELSE '' END,
    CASE WHEN filter_city IS NOT NULL AND filter_city <> '' THEN ' AND p.city ILIKE ' || quote_literal('%' || filter_city || '%') ELSE '' END,
    CASE WHEN filter_education IS NOT NULL AND filter_education <> '' THEN ' AND p.education ILIKE ' || quote_literal('%' || filter_education || '%') ELSE '' END,
    CASE WHEN filter_is_nubo_student IS NOT NULL THEN ' AND p.is_nubo_student = ' || filter_is_nubo_student::text ELSE '' END,
    CASE WHEN filter_income_min IS NOT NULL THEN ' AND pref.family_income_per_capita >= ' || filter_income_min::text ELSE '' END,
    CASE WHEN filter_income_max IS NOT NULL THEN ' AND pref.family_income_per_capita <= ' || filter_income_max::text ELSE '' END,
    CASE WHEN filter_quota_types IS NOT NULL THEN ' AND pref.quota_types && ' || quote_literal(filter_quota_types::text) || '::text[]' ELSE '' END,
    CASE WHEN filter_state IS NOT NULL THEN ' AND p.state = ' || quote_literal(filter_state) ELSE '' END,
    CASE WHEN filter_age_min IS NOT NULL THEN ' AND p.age >= ' || filter_age_min::text ELSE '' END,
    CASE WHEN filter_age_max IS NOT NULL THEN ' AND p.age <= ' || filter_age_max::text ELSE '' END
    );
    EXECUTE v_sql INTO total_count, unique_cities, unique_states, avg_age;
    RETURN jsonb_build_object('total_students', total_count, 'total_cities', unique_cities, 'total_states', unique_states, 'average_age', ROUND(avg_age, 1));
END;
$function$;

-- 5.23 get_students_paginated
CREATE OR REPLACE FUNCTION public.get_students_paginated(
  p_page integer, p_page_size integer, p_filter_name text DEFAULT NULL,
  p_filter_city text DEFAULT NULL, p_filter_education text DEFAULT NULL,
  p_filter_is_nubo_student boolean DEFAULT NULL,
  p_filter_income_min numeric DEFAULT NULL, p_filter_income_max numeric DEFAULT NULL,
  p_filter_quota_types text[] DEFAULT NULL,
  p_sort_by text DEFAULT 'created_at', p_sort_order text DEFAULT 'desc',
  p_filter_state text DEFAULT NULL, p_filter_age_min integer DEFAULT NULL,
  p_filter_age_max integer DEFAULT NULL
)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE 
  v_offset INT; v_total_count BIGINT; v_data JSON; v_order_clause TEXT;
BEGIN
  v_offset := p_page * p_page_size;
  v_order_clause := CASE p_sort_by
    WHEN 'full_name' THEN 'p.full_name'
    WHEN 'city' THEN 'p.city'
    WHEN 'education' THEN 'p.education'
    WHEN 'is_nubo_student' THEN 'p.is_nubo_student'
    WHEN 'created_at' THEN 'p.created_at'
    ELSE 'p.created_at'
  END;
  SELECT count(DISTINCT p.id) INTO v_total_count 
  FROM public.user_profiles p LEFT JOIN public.user_preferences pref ON p.id = pref.user_id
  WHERE (p_filter_name IS NULL OR p.full_name ILIKE '%' || p_filter_name || '%')
    AND (p_filter_city IS NULL OR p.city ILIKE '%' || p_filter_city || '%')
    AND (p_filter_education IS NULL OR p.education ILIKE '%' || p_filter_education || '%')
    AND (p_filter_is_nubo_student IS NULL OR p.is_nubo_student = p_filter_is_nubo_student)
    AND (p_filter_income_min IS NULL OR pref.family_income_per_capita >= p_filter_income_min)
    AND (p_filter_income_max IS NULL OR pref.family_income_per_capita <= p_filter_income_max)
    AND (p_filter_quota_types IS NULL OR pref.quota_types && p_filter_quota_types)
    AND (p_filter_state IS NULL OR p.state = p_filter_state)
    AND (p_filter_age_min IS NULL OR p.age >= p_filter_age_min)
    AND (p_filter_age_max IS NULL OR p.age <= p_filter_age_max);
  EXECUTE format('
    SELECT coalesce(json_agg(t.*), ''[]''::json)
    FROM (
        SELECT DISTINCT ON (p.id) p.* 
        FROM public.user_profiles p
        LEFT JOIN public.user_preferences pref ON p.id = pref.user_id
        WHERE ($1 IS NULL OR p.full_name ILIKE ''%%'' || $1 || ''%%'')
          AND ($2 IS NULL OR p.city ILIKE ''%%'' || $2 || ''%%'')
          AND ($3 IS NULL OR p.education ILIKE ''%%'' || $3 || ''%%'')
          AND ($4 IS NULL OR p.is_nubo_student = $4)
          AND ($5 IS NULL OR pref.family_income_per_capita >= $5)
          AND ($6 IS NULL OR pref.family_income_per_capita <= $6)
          AND ($7 IS NULL OR pref.quota_types && $7)
          AND ($10 IS NULL OR p.state = $10)
          AND ($11 IS NULL OR p.age >= $11)
          AND ($12 IS NULL OR p.age <= $12)
        ORDER BY p.id, %s %s
        LIMIT $8 OFFSET $9
    ) t',
    v_order_clause,
    CASE WHEN lower(p_sort_order) = 'asc' THEN 'ASC' ELSE 'DESC' END
  ) USING p_filter_name, p_filter_city, p_filter_education, p_filter_is_nubo_student,
          p_filter_income_min, p_filter_income_max, p_filter_quota_types,
          p_page_size, v_offset, p_filter_state, p_filter_age_min, p_filter_age_max
  INTO v_data;
  RETURN json_build_object('data', v_data, 'count', v_total_count);
END;
$function$;

-- 5.24 standardize_user_locations (PROCEDURE, not FUNCTION)
CREATE OR REPLACE PROCEDURE public.standardize_user_locations()
 LANGUAGE plpgsql
AS $procedure$
BEGIN
    UPDATE public.user_profiles up
    SET state = UPPER((regexp_matches(city, '(.+?)\s*[-\/]\s*([a-zA-Z]{2})\s*$', 'i'))[2]),
        city = TRIM((regexp_matches(city, '(.+?)\s*[-\/]\s*([a-zA-Z]{2})\s*$', 'i'))[1])
    WHERE (state IS NULL OR state = '') AND city ~* '(.+?)\s*[-\/]\s*([a-zA-Z]{2})\s*$';

    UPDATE public.user_profiles up
    SET state = s.uf, city = NULL
    FROM public.states s 
    WHERE (up.state IS NULL OR up.state = '') AND (LOWER(TRIM(up.city)) = LOWER(s.name) OR LOWER(f_unaccent(TRIM(up.city))) = LOWER(f_unaccent(s.name)));
END;
$procedure$;
