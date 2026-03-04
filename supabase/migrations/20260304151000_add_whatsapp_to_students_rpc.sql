-- Update get_students_paginated to include phone (whatsapp) from auth.users
-- This requires SECURITY DEFINER to access auth schema

CREATE OR REPLACE FUNCTION public.get_students_paginated(
  p_page integer,
  p_page_size integer,
  p_filter_name text DEFAULT NULL,
  p_filter_city text DEFAULT NULL,
  p_filter_education text DEFAULT NULL,
  p_filter_is_nubo_student boolean DEFAULT NULL,
  p_filter_income_min numeric DEFAULT NULL,
  p_filter_income_max numeric DEFAULT NULL,
  p_filter_quota_types text[] DEFAULT NULL,
  p_sort_by text DEFAULT 'created_at',
  p_sort_order text DEFAULT 'desc',
  p_filter_state text DEFAULT NULL,
  p_filter_age_min integer DEFAULT NULL,
  p_filter_age_max integer DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE 
  v_offset INT; 
  v_total_count BIGINT; 
  v_data JSON;
  v_order_clause TEXT;
BEGIN
  v_offset := p_page * p_page_size;

  -- Map sort_by to actual columns
  v_order_clause := CASE p_sort_by
    WHEN 'full_name' THEN 'p.full_name'
    WHEN 'city' THEN 'p.city'
    WHEN 'education' THEN 'p.education'
    WHEN 'is_nubo_student' THEN 'p.is_nubo_student'
    WHEN 'created_at' THEN 'p.created_at'
    ELSE 'p.created_at'
  END;

  -- 1. Calculate Total Count
  SELECT count(DISTINCT p.id) INTO v_total_count 
  FROM public.user_profiles p 
  LEFT JOIN public.user_preferences pref ON p.id = pref.user_id
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

  -- 2. Fetch Data with dynamic sort
  EXECUTE format('
    SELECT coalesce(json_agg(t.*), ''[]''::json)
    FROM (
        SELECT DISTINCT ON (p.id) p.*, u.phone as whatsapp
        FROM public.user_profiles p
        LEFT JOIN public.user_preferences pref ON p.id = pref.user_id
        LEFT JOIN auth.users u ON p.id = u.id
        WHERE
          ($1 IS NULL OR p.full_name ILIKE ''%%'' || $1 || ''%%'')
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
        LIMIT $8
        OFFSET $9
    ) t',
    v_order_clause,
    CASE WHEN lower(p_sort_order) = 'asc' THEN 'ASC' ELSE 'DESC' END
  )
  USING 
    p_filter_name, 
    p_filter_city, 
    p_filter_education, 
    p_filter_is_nubo_student, 
    p_filter_income_min, 
    p_filter_income_max, 
    p_filter_quota_types,
    p_page_size,
    v_offset,
    p_filter_state,
    p_filter_age_min,
    p_filter_age_max
  INTO v_data;

  RETURN json_build_object('data', v_data, 'count', v_total_count);
END;
$$;

-- Grant access to authenticated users (Supabase API)
GRANT EXECUTE ON FUNCTION public.get_students_paginated TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_students_paginated TO service_role;
