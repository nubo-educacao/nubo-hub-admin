-- Migration: add_program_match_fields
-- Add active_application_target_id and eligibility_results to user_profiles

-- Add columns to user_profiles
ALTER TABLE "public"."user_profiles"
ADD COLUMN IF NOT EXISTS "active_application_target_id" UUID REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS "eligibility_results" JSONB;

-- Comment on columns
COMMENT ON COLUMN "public"."user_profiles"."active_application_target_id" IS 'ID of the profile (self or dependent) currently being evaluated for an application.';
COMMENT ON COLUMN "public"."user_profiles"."eligibility_results" IS 'Latest eligibility evaluation results from evaluatePassportEligibilityTool.';
