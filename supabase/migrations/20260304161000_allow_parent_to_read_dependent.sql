-- Remove existing policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "Users can view dependent profiles" ON public.user_profiles;

-- Create policy to allow parents to read their dependents' profiles
CREATE POLICY "Users can view dependent profiles" ON public.user_profiles
    FOR SELECT
    USING (auth.uid() = parent_user_id);
