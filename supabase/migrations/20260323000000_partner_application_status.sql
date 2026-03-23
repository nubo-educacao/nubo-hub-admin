-- Migration: 20260323000000_partner_application_status
-- Adiciona o controle applications_open e configura o cron para fechar inscrições expiradas
-- 02:59 UTC = 23:59 BRT (Brasília)

-- 1. Add column to partners table
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS applications_open BOOLEAN DEFAULT true;

-- 2. Ensure pg_cron extension is available
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 3. Schedule job to close effectively "yesterday's" expired end_dates at 23:59 BRT
SELECT cron.schedule(
    'close_expired_partners',
    '59 2 * * *',
    $$
        UPDATE public.partners 
        SET applications_open = false 
        WHERE applications_open = true 
        AND dates IS NOT NULL 
        AND jsonb_typeof(dates) = 'array'
        AND jsonb_array_length(dates) > 0 
        AND (dates->0->>'end_date') IS NOT NULL
        AND (dates->0->>'end_date') != ''
        AND (dates->0->>'end_date')::date <= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date;
    $$
);

-- 4. Recreate manage_partner RPC to accept and write p_applications_open
DROP FUNCTION IF EXISTS public.manage_partner(uuid, text, text, text, text, text, jsonb, text, text, boolean);
-- Also drop old parameter sets just to be safe if its overloaded
DROP FUNCTION IF EXISTS public.manage_partner(uuid, text, text, text, text, text, jsonb, text, text);

CREATE OR REPLACE FUNCTION public.manage_partner(
    p_id uuid DEFAULT NULL::uuid,
    p_name text DEFAULT NULL::text,
    p_description text DEFAULT NULL::text,
    p_location text DEFAULT NULL::text,
    p_type text DEFAULT NULL::text,
    p_income text DEFAULT NULL::text,
    p_dates jsonb DEFAULT NULL::jsonb,
    p_link text DEFAULT NULL::text,
    p_coverimage text DEFAULT NULL::text,
    p_applications_open boolean DEFAULT true,
    p_delete boolean DEFAULT false
) RETURNS public.partners
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_partner public.partners;
BEGIN
    -- Permission check: Only users with 'Dashboard' permission can manage partners
    IF NOT EXISTS (
        SELECT 1 FROM public.user_permissions 
        WHERE user_id = auth.uid() 
        AND permission = 'Dashboard'
    ) THEN
        RAISE EXCEPTION 'Acesso negado. Permissão insuficiente.';
    END IF;

    IF p_delete AND p_id IS NOT NULL THEN
        DELETE FROM public.partners WHERE id = p_id RETURNING * INTO v_partner;
    ELSIF p_id IS NULL THEN
        -- Create new partner
        INSERT INTO public.partners (
            name, 
            description, 
            location, 
            type, 
            income, 
            dates, 
            link, 
            coverimage,
            applications_open
        )
        VALUES (
            p_name, 
            p_description, 
            p_location, 
            p_type, 
            p_income, 
            p_dates, 
            p_link, 
            p_coverimage,
            COALESCE(p_applications_open, true)
        )
        RETURNING * INTO v_partner;
    ELSE
        -- Update existing partner
        UPDATE public.partners
        SET 
            name = COALESCE(p_name, name),
            description = COALESCE(p_description, description),
            location = COALESCE(p_location, location),
            type = COALESCE(p_type, type),
            income = COALESCE(p_income, income),
            dates = COALESCE(p_dates, dates),
            link = COALESCE(p_link, link),
            coverimage = COALESCE(p_coverimage, coverimage),
            applications_open = COALESCE(p_applications_open, applications_open),
            updated_at = NOW()
        WHERE id = p_id
        RETURNING * INTO v_partner;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Parceiro não encontrado.';
        END IF;
    END IF;

    RETURN v_partner;
END;
$$;
