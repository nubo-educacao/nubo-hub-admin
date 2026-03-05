-- Drop existing versions to avoid ambiguity
DROP FUNCTION IF EXISTS public.get_partners();
DROP FUNCTION IF EXISTS public.get_partners(text, text);

-- Create unified version that works for both nubo-hub-app and nubo-hub-admin
-- Using SECURITY DEFINER to ensure consistent access even if RLS is added later
CREATE OR REPLACE FUNCTION public.get_partners(
  p_sort_by text DEFAULT 'name',
  p_sort_order text DEFAULT 'asc'
)
RETURNS SETOF public.partners
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY EXECUTE format('
    SELECT * 
    FROM public.partners
    ORDER BY %I %s',
    CASE 
      WHEN p_sort_by IN ('name', 'location', 'type') THEN p_sort_by 
      ELSE 'name' 
    END,
    CASE WHEN lower(p_sort_order) = 'desc' THEN 'DESC' ELSE 'ASC' END
  );
END;
$$;

-- Explicitly grant permissions to all relevant roles
GRANT EXECUTE ON FUNCTION public.get_partners(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_partners(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_partners(text, text) TO service_role;

-- Documenting that this function is used by:
-- 1. nubo-hub-app (Catalog display)
-- 2. nubo-hub-admin (Partners management list)
