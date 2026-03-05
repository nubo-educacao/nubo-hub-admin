ALTER TABLE IF EXISTS public.partner_steps ADD COLUMN IF NOT EXISTS introduction TEXT;
ALTER TABLE IF EXISTS public.partner_steps ADD COLUMN IF NOT EXISTS secret_step BOOLEAN NOT NULL DEFAULT FALSE;

-- Ensure partner_forms has the necessary properties for criteria and optionality
ALTER TABLE IF EXISTS public.partner_forms ADD COLUMN IF NOT EXISTS optional BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS public.partner_forms ADD COLUMN IF NOT EXISTS is_criterion BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS public.partner_forms ADD COLUMN IF NOT EXISTS mapping_source TEXT;
ALTER TABLE IF EXISTS public.partner_forms ADD COLUMN IF NOT EXISTS criterion_rule JSONB;
