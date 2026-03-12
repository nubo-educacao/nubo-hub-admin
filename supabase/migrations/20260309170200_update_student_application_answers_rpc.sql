-- Create or replace the RPC to update student application answers using JSONB merge
CREATE OR REPLACE FUNCTION update_student_application_answers(
    p_application_id UUID,
    p_answers JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE student_applications
    -- Merge the existing answers with the new answers using the || operator
    -- Note: COALESCE handles the case where answers might be NULL initially
    SET 
        answers = COALESCE(answers, '{}'::jsonb) || p_answers,
        updated_at = NOW()
    WHERE id = p_application_id;
END;
$$;
