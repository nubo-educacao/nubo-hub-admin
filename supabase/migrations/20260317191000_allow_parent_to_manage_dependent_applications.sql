-- Create policy to allow parents to read their dependents' applications
CREATE POLICY "Users can view dependent applications" ON public.student_applications
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = student_applications.user_id 
            AND parent_user_id = auth.uid()
        )
    );

-- Create policy to allow parents to update their dependents' applications
CREATE POLICY "Users can update dependent applications" ON public.student_applications
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = student_applications.user_id 
            AND parent_user_id = auth.uid()
        )
    );
