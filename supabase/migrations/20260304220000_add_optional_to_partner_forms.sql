-- Add optional column to partner_forms
-- Fields with optional = FALSE (default) are required during form submission
ALTER TABLE partner_forms ADD COLUMN IF NOT EXISTS optional BOOLEAN NOT NULL DEFAULT FALSE;
