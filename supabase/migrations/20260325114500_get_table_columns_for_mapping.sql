-- Migration: Create RPC to get table columns for Auto-Fill mapping
-- Description: Fetches public columns of specific tables and selected auth schema fields

CREATE OR REPLACE FUNCTION get_table_columns_for_mapping(table_names text[])
RETURNS TABLE(t_schema text, t_name text, c_name text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.table_schema::text as t_schema, 
        c.table_name::text as t_name, 
        c.column_name::text as c_name
    FROM information_schema.columns c
    WHERE 
        (c.table_schema = 'public' AND c.table_name = ANY(table_names))
        OR 
        (c.table_schema = 'auth' AND c.table_name = 'users' AND c.column_name IN ('email', 'phone'))
    ORDER BY c.table_schema, c.table_name, c.ordinal_position;
END;
$$;
