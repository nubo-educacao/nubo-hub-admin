-- Migration to backfill external_redirect_config into user_profiles.eligibility_results
-- This ensures that existing evaluation results stored in user attributes include the redirect config
-- Also guarantees that Fundação Behring is always part of the user's eligibility array

WITH updated_arrays AS (
  SELECT 
    t.id,
    (
      SELECT jsonb_agg(
        CASE
          WHEN p.external_redirect_config IS NOT NULL THEN
            item || jsonb_build_object('external_redirect_config', p.external_redirect_config)
          ELSE
            item
        END
      )
      FROM jsonb_array_elements(t.arr) AS item
      LEFT JOIN partners p ON p.id = (item->>'partner_id')::uuid
    ) as new_results
  FROM (
    SELECT 
      id, 
      CASE 
        WHEN NOT (COALESCE(eligibility_results, '[]'::jsonb) @> '[{"partner_id": "cd6be5e6-0131-40d5-8644-e949b2f244af"}]') THEN
          COALESCE(eligibility_results, '[]'::jsonb) || jsonb_build_object(
            'partner_id', 'cd6be5e6-0131-40d5-8644-e949b2f244af',
            'partner_name', 'Fundação Behring',
            'met_criteria', 0,
            'total_criteria', 0,
            'details', '[]'::jsonb
          )
        ELSE
          eligibility_results
      END as arr
    FROM user_profiles
  ) t
)
UPDATE user_profiles
SET eligibility_results = updated_arrays.new_results
FROM updated_arrays
WHERE user_profiles.id = updated_arrays.id;
