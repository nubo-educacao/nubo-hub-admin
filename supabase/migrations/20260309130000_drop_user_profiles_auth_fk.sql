-- Drop FK from user_profiles.id to auth.users.id
-- This allows creating profiles for dependents (isdependent=true) who don't have an auth.users record.
-- The relationship to the responsible user is maintained via parent_user_id.
ALTER TABLE public.user_profiles
DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;

-- Drop FK from user_preferences.user_id to auth.users.id
-- This allows creating preferences for dependents.
ALTER TABLE public.user_preferences
DROP CONSTRAINT IF EXISTS user_preferences_user_id_fkey;
