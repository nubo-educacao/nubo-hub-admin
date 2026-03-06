-- Add advanced logic properties to partner_steps and partner_forms
ALTER TABLE partner_steps
ADD COLUMN IF NOT EXISTS is_iterable BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS repeat_limit INTEGER NULL,
ADD COLUMN IF NOT EXISTS conditional_rule JSONB NULL;

ALTER TABLE partner_forms
ADD COLUMN IF NOT EXISTS conditional_rule JSONB NULL;
