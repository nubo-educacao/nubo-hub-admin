-- Migration to add partner steps

CREATE TABLE IF NOT EXISTS public.partner_steps (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    partner_id uuid NOT NULL,
    step_name text NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT partner_steps_pkey PRIMARY KEY (id),
    CONSTRAINT partner_steps_partner_id_fkey FOREIGN KEY (partner_id)
        REFERENCES public.partners (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);

ALTER TABLE public.partner_forms
    ADD COLUMN IF NOT EXISTS step_id uuid;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'partner_forms_step_id_fkey') THEN
        ALTER TABLE public.partner_forms
            ADD CONSTRAINT partner_forms_step_id_fkey FOREIGN KEY (step_id)
            REFERENCES public.partner_steps (id) MATCH SIMPLE
            ON UPDATE NO ACTION
            ON DELETE SET NULL;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.partner_steps ENABLE ROW LEVEL SECURITY;

-- Create policies for partner_steps
-- Allowing all authenticated users for now, matching common admin setups or restricted by further app logic
CREATE POLICY "Enable read access for all authenticated users" ON public.partner_steps
    AS PERMISSIVE FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert access for all authenticated users" ON public.partner_steps
    AS PERMISSIVE FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable update access for all authenticated users" ON public.partner_steps
    AS PERMISSIVE FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable delete access for all authenticated users" ON public.partner_steps
    AS PERMISSIVE FOR DELETE
    TO authenticated
    USING (true);
