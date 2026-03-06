-- Fix all users who have a NULL passport_phase for the 'passport_workflow'
-- This ensures that the agent logic can always identify the current stage of the user.

UPDATE user_profiles 
SET passport_phase = 'INTRO' 
WHERE passport_phase IS NULL 
AND active_workflow = 'passport_workflow';
