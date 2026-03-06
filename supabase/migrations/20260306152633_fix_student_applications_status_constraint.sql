-- Migration to expand student_applications status check constraint
-- This allows both older lowercase statuses and newer uppercase statuses (DRAFT, SUBMITTED).

-- 1. Drop existing constraint if it exists
ALTER TABLE public.student_applications 
DROP CONSTRAINT IF EXISTS student_applications_status_check;

-- 2. Add updated constraint
ALTER TABLE public.student_applications 
ADD CONSTRAINT student_applications_status_check 
CHECK (status IN (
    'started', 'eligible', 'ineligible', 'submitted',
    'DRAFT', 'SUBMITTED', 'ELIGIBLE', 'INELIGIBLE'
));

-- 3. Optional: Add comment for clarity
COMMENT ON COLUMN public.student_applications.status IS 'Application status. Supports both lowercase (legacy) and uppercase (standard) variants.';
