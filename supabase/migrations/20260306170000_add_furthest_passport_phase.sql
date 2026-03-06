-- Migration: Add furthest_passport_phase to user_profiles
-- Description: Persists the furthest phase reached by the user to allow navigation back after data edits.

-- 1. Add column
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS furthest_passport_phase TEXT DEFAULT 'INTRO';

-- 2. Add check constraint
ALTER TABLE public.user_profiles 
DROP CONSTRAINT IF EXISTS user_profiles_furthest_passport_phase_check;

ALTER TABLE public.user_profiles 
ADD CONSTRAINT user_profiles_furthest_passport_phase_check 
CHECK (furthest_passport_phase IN ('INTRO', 'ONBOARDING', 'ASK_DEPENDENT', 'DEPENDENT_ONBOARDING', 'PROGRAM_MATCH', 'EVALUATE', 'CONCLUDED'));

-- 3. Initial sync: set furthest to current
UPDATE public.user_profiles 
SET furthest_passport_phase = passport_phase 
WHERE furthest_passport_phase = 'INTRO' AND passport_phase IS NOT NULL;

-- 4. Create function to get phase weight
CREATE OR REPLACE FUNCTION public.get_passport_phase_weight(phase TEXT)
RETURNS INTEGER AS $$
BEGIN
    RETURN CASE phase
        WHEN 'INTRO' THEN 1
        WHEN 'ONBOARDING' THEN 2
        WHEN 'ASK_DEPENDENT' THEN 3
        WHEN 'DEPENDENT_ONBOARDING' THEN 4
        WHEN 'PROGRAM_MATCH' THEN 5
        WHEN 'EVALUATE' THEN 6
        WHEN 'CONCLUDED' THEN 7
        ELSE 0
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 5. Create trigger function to auto-update furthest_passport_phase
CREATE OR REPLACE FUNCTION public.trg_update_furthest_passport_phase()
RETURNS TRIGGER AS $$
BEGIN
    -- If the new passport_phase is "further" than the current furthest_passport_phase, update it.
    IF public.get_passport_phase_weight(NEW.passport_phase) > public.get_passport_phase_weight(OLD.furthest_passport_phase) THEN
        NEW.furthest_passport_phase := NEW.passport_phase;
    END IF;
    
    -- Ensure furthest_passport_phase never regresses
    IF public.get_passport_phase_weight(NEW.furthest_passport_phase) < public.get_passport_phase_weight(OLD.furthest_passport_phase) THEN
        NEW.furthest_passport_phase := OLD.furthest_passport_phase;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Attach trigger
DROP TRIGGER IF EXISTS update_furthest_passport_phase_trg ON public.user_profiles;
CREATE TRIGGER update_furthest_passport_phase_trg
BEFORE UPDATE OF passport_phase, furthest_passport_phase ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.trg_update_furthest_passport_phase();
