-- Migration to ensure unique field_name per partner in partner_forms
-- 1. Identify and rename duplicates by appending a numeric suffix
WITH duplicates AS (
    SELECT 
        id,
        field_name,
        partner_id,
        row_number() OVER (PARTITION BY partner_id, field_name ORDER BY created_at) as rn
    FROM partner_forms
)
UPDATE partner_forms
SET field_name = duplicates.field_name || '_' || (duplicates.rn)::text
FROM duplicates
WHERE partner_forms.id = duplicates.id
AND duplicates.rn > 1;

-- 2. Add unique constraint to prevent future duplicates
-- Using a unique index to allow null step_id if needed, but scoped to partner_id and field_name
ALTER TABLE partner_forms 
ADD CONSTRAINT partner_forms_partner_id_field_name_key UNIQUE (partner_id, field_name);
